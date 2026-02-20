use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use once_cell::sync::Lazy;
use directories::ProjectDirs;
use tokio::sync::Mutex;

static INSTANCES: Lazy<Mutex<HashMap<String, tokio::process::Child>>> = Lazy::new(|| Mutex::new(HashMap::new()));

use lighty_launcher::prelude::*;
use lighty_launcher::event::{EventBus, Event};
use lighty_launcher::auth::OfflineAuth;
use lighty_launcher::java::jre_downloader;
use lighty_launcher::loaders::{VersionMetaData};
use lighty_launcher::launch::Installer;
use lighty_launcher::launch::LaunchArguments;

static LAUNCHER_DIRS: Lazy<ProjectDirs> = Lazy::new(|| {
    ProjectDirs::from("com", "nanoclient", "launcher")
        .expect("Failed to get project directories")
});

const GITHUB_API_BASE: &str = "https://api.github.com/repos/Fami-PL/nano-client-api/contents";
const GITHUB_TOKEN: &str = "";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    #[serde(default)] pub id: String,
    pub name: String,
    #[serde(default)] pub filename: String,
    pub url: String,
    #[serde(default)] pub sha256: Option<String>,
    #[serde(default)] pub required: bool,
    #[serde(default = "default_category")] pub category: String,
    pub description: Option<String>,
    pub size: Option<u64>,
}

fn default_category() -> String { "utility".to_string() }

fn parse_mods_from_json(json: &serde_json::Value) -> Vec<ModEntry> {
    let mut mods = Vec::new();
    if let Some(mods_raw) = json.get("mods").and_then(|m| m.as_array()) {
        for m in mods_raw {
            let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let file = m.get("file").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let url = m.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let category = m.get("category").and_then(|v| v.as_str()).unwrap_or("utility").to_string();
            let required = m.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
            mods.push(ModEntry {
                id: name.to_lowercase().replace(" ", "-"),
                name,
                filename: file,
                url,
                sha256: None,
                required,
                category,
                description: m.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                size: m.get("size_bytes").and_then(|v| v.as_u64()),
            });
        }
    }
    mods
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress { pub file: String, pub current: u64, pub total: u64 }

fn default_client_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".nanoclient")
}

fn client_dir_for(custom: Option<&str>) -> PathBuf {
    match custom {
        Some(s) if !s.is_empty() => {
            if s.starts_with('~') { dirs::home_dir().unwrap_or_default().join(&s[2..]) } 
            else { PathBuf::from(s) }
        }
        _ => default_client_dir(),
    }
}

async fn download_github_file(path: &str) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::builder().user_agent("NanoClient/1.2").build()?;
    let url = format!("{}/{}", GITHUB_API_BASE, path);
    let mut request = client.get(&url);
    if !GITHUB_TOKEN.is_empty() { request = request.header("Authorization", format!("token {}", GITHUB_TOKEN)); }
    let resp = request.header("Accept", "application/vnd.github.v3.raw").send().await?;
    if !resp.status().is_success() { anyhow::bail!("GitHub API error: {} at {}", resp.status(), url); }
    Ok(resp.bytes().await?.to_vec())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthSearchResponse { 
    pub hits: Vec<ModrinthSearchResult>, 
    pub total_hits: u32,
    pub offset: u32,
    pub limit: u32
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthSearchResult { 
    pub project_id: String, 
    pub title: String, 
    pub description: String, 
    pub icon_url: Option<String>, 
    pub author: String,
    pub categories: Vec<String>,
    pub downloads: Option<u64>
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthVersion { pub id: String, pub files: Vec<ModrinthFile>, pub game_versions: Vec<String>, pub loaders: Vec<String> }
#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthFile { pub url: String, pub filename: String, pub primary: bool }

#[tauri::command]
pub async fn get_active_instances() -> Vec<ActiveInstance> {
    let instances = INSTANCES.lock().await;
    instances.keys().map(|k| {
        let parts: Vec<&str> = k.split(':').collect();
        ActiveInstance { version: parts[0].to_string(), username: parts[1].to_string() }
    }).collect()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveInstance { pub version: String, pub username: String }

#[tauri::command]
pub async fn kill_instance(version: String, username: String) -> Result<(), String> {
    let key = format!("{}:{}", version, username);
    let mut instances = INSTANCES.lock().await;
    if let Some(mut child) = instances.remove(&key) { let _ = child.kill().await; }
    Ok(())
}

#[tauri::command]
pub async fn search_modrinth(query: String, mc_version: String, offset: u32, limit: u32, index: String) -> Result<ModrinthSearchResponse, String> {
    let client = reqwest::Client::builder().user_agent("NanoClient/1.2").build().map_err(|e| e.to_string())?;
    let facets = format!("[[\"categories:fabric\"],[\"versions:{}\"],[\"project_type:mod\"]]", mc_version);
    let url = format!("https://api.modrinth.com/v2/search?query={}&facets={}&offset={}&limit={}&index={}", urlencoding::encode(&query), urlencoding::encode(&facets), offset, limit, index);
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let data: ModrinthSearchResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn install_modrinth_mod(app: AppHandle, project_id: String, mc_version: String, custom_dir: Option<String>) -> Result<(), String> {
    let client = reqwest::Client::builder().user_agent("NanoClient/1.2").build().map_err(|e| e.to_string())?;
    let url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let versions: Vec<ModrinthVersion> = resp.json().await.map_err(|e| e.to_string())?;
    let best = versions.into_iter().find(|v| v.game_versions.contains(&mc_version) && v.loaders.contains(&"fabric".to_string())).ok_or("No version found")?;
    let file = best.files.iter().find(|f| f.primary).or(best.files.first()).ok_or("No file found")?;
    
    let base_dir = client_dir_for(custom_dir.as_deref());
    let version_mods_dir = base_dir.join("profiles").join("mods").join(&mc_version);
    tokio::fs::create_dir_all(&version_mods_dir).await.map_err(|e| e.to_string())?;
    
    let dest = version_mods_dir.join(&file.filename);
    download_file(&file.url, &dest, &file.filename, &app).await.map_err(|e| e.to_string())?;
    let _ = app.emit("minecraft-log", format!("[INFO] Installed Modrinth mod: {}", file.filename));
    Ok(())
}

async fn download_file(url: &str, dest: &Path, filename: &str, app: &AppHandle) -> anyhow::Result<()> {
    use futures_util::StreamExt;
    if dest.exists() { return Ok(()); }
    let client = reqwest::Client::builder().user_agent("NanoClient/1.2").build()?;
    let resp = client.get(url).send().await?;
    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let tmp = dest.with_extension("tmp");
    let mut file = tokio::fs::File::create(&tmp).await?;
    let mut current = 0;
    while let Some(chunk) = stream.next().await {
        let b = chunk?;
        current += b.len() as u64;
        tokio::io::AsyncWriteExt::write_all(&mut file, &b).await?;
        let _ = app.emit("download-progress", DownloadProgress { file: filename.to_string(), current, total });
    }
    tokio::fs::rename(&tmp, dest).await?;
    Ok(())
}

#[tauri::command]
pub async fn fetch_mods_for_version(version: String) -> Result<Vec<ModEntry>, String> {
    let api_path = format!("{}/{}-Mods.json", version, version);
    let content = download_github_file(&api_path).await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&String::from_utf8_lossy(&content)).map_err(|e| e.to_string())?;
    Ok(parse_mods_from_json(&json))
}

#[tauri::command] pub fn get_client_dir(custom_dir: Option<String>) -> String { client_dir_for(custom_dir.as_deref()).to_string_lossy().to_string() }

#[tauri::command]
pub async fn prepare_and_launch(app: AppHandle, version: String, username: String, ram_gb: u32, java_path: Option<String>, extra_jvm_args: Option<String>, client_dir: Option<String>, disabled_mods: Vec<String>) -> Result<(), String> {
    prepare_and_launch_inner(app, version, username, ram_gb, java_path, extra_jvm_args, client_dir, disabled_mods).await.map_err(|e| e.to_string())
}

async fn prepare_and_launch_inner(app: AppHandle, version: String, username: String, ram_gb: u32, java_path: Option<String>, extra_jvm_args: Option<String>, client_dir: Option<String>, disabled_mods: Vec<String>) -> anyhow::Result<()> {
    let base_dir = client_dir_for(client_dir.as_deref());
    let mc_dir = base_dir.join("profiles");
    let version_mods_root = mc_dir.join("mods").join(&version);
    let preinstalled_mods_dir = version_mods_root.join("Preinstalled");
    
    tokio::fs::create_dir_all(&base_dir.join("java")).await?;
    tokio::fs::create_dir_all(&mc_dir.join("versions")).await?;
    tokio::fs::create_dir_all(&preinstalled_mods_dir).await?;

    let _ = app.emit("minecraft-log", format!("[INFO] Launching {} for {}", version, username));

    let api_path = format!("{}/{}-Mods.json", version, version);
    let content = download_github_file(&api_path).await?;
    let manifest: serde_json::Value = serde_json::from_str(&String::from_utf8(content)?)?;
    let mods = parse_mods_from_json(&manifest);
    let fabric_loader_ver = manifest.get("metadata").and_then(|m| m.get("fabric_loader")).and_then(|v| v.as_str()).unwrap_or("0.18.1").to_string();

    let event_bus = EventBus::new(200);
    let mut receiver = event_bus.subscribe();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.next().await {
            match event {
                Event::Launch(LaunchEvent::InstallStarted { total_bytes, .. }) => { let _ = app_clone.emit("minecraft-log", format!("[INFO] Preparing game files ({} MB)...", total_bytes / 1024 / 1024)); }
                Event::Launch(LaunchEvent::Launching { .. }) => { let _ = app_clone.emit("minecraft-log", "[INFO] Launching game process..."); }
                _ => {}
            }
        }
    });

    let mut instance = VersionBuilder::new(&format!("versions/{}", version), Loader::Fabric, &fabric_loader_ver, &version, &LAUNCHER_DIRS)
        .with_custom_game_dir(mc_dir.clone())
        .with_custom_java_dir(base_dir.join("java"));
    
    if let Some(p) = java_path.filter(|p| !p.is_empty() && Path::new(p).exists()) { instance = instance.with_custom_java_dir(PathBuf::from(p)); }

    let mut auth = OfflineAuth::new(&username);
    let profile = auth.authenticate(Some(&event_bus)).await?;
    let metadata = instance.get_fabric_complete().await?;
    let version_ref = if let VersionMetaData::Version(v) = &*metadata { v } else { anyhow::bail!("Invalid meta") };
    instance.install(&version_ref, Some(&event_bus)).await?;

    let mut java_ver = version_ref.java_version.major_version;
    if version.starts_with("1.20") { java_ver = 17; } else if version.starts_with("1.21") { java_ver = 21; }
    let java_binary = jre_downloader::jre_download(instance.java_dirs(), &JavaDistribution::Temurin, &java_ver, |_,_|{}, Some(&event_bus)).await?;

    // PREINSTALLED MODS: Collect enabled JARs
    let mut enabled_jar_paths = Vec::new();
    let disabled_set: HashSet<String> = disabled_mods.into_iter().collect();

    for m in &mods {
        let dest = preinstalled_mods_dir.join(if m.filename.is_empty() { &m.name } else { &m.filename });
        
        // Only download if NOT explicitly disabled across launches? 
        // No, always download, but only LOAD if enabled.
        if !dest.exists() && !m.url.is_empty() { download_file(&m.url, &dest, &m.name, &app).await?; }
        
        if !disabled_set.contains(&m.id) {
            enabled_jar_paths.push(dest.to_string_lossy().to_string());
        }
    }

    // USER MODS (Modrinth): Add all JARs from version folder (they don't have IDs in this launch context yet)
    if let Ok(mut entries) = tokio::fs::read_dir(&version_mods_root).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jar") {
                // For now, we don't have a good way to match Modrinth JARs to IDs here easily,
                // so we load all of them. Modrinth mods can be "disabled" by deleting them 
                // from the folder in the UI anyway.
                enabled_jar_paths.push(path.to_string_lossy().to_string());
            }
        }
    }
    
    let mut jvm_set = HashSet::new();
    jvm_set.insert("AlwaysPreTouch".to_string());
    jvm_set.insert("DisableExplicitGC".to_string());
    jvm_set.insert("UseG1GC".to_string());
    jvm_set.insert("MaxGCPauseMillis=50".to_string());

    if let Some(extra) = extra_jvm_args { for arg in extra.split_whitespace() { jvm_set.insert(arg.trim_start_matches('-').replace("XX:+", "").replace("XX:", "")); } }

    let mut actual_args = Vec::new();
    actual_args.push("-XX:+UnlockExperimentalVMOptions".into());
    actual_args.push("-XX:+UnlockDiagnosticVMOptions".into());
    actual_args.push(format!("-Xmx{}G", ram_gb));
    actual_args.push(format!("-Xms{}G", (ram_gb / 2).max(1)));
    
    // FABRIC MODS: Individual enabled JARs!
    if !enabled_jar_paths.is_empty() {
        actual_args.push(format!("-Dfabric.addMods={}", enabled_jar_paths.join(":")));
    }

    for flag in jvm_set {
        if flag.contains('=') { actual_args.push(format!("-XX:{}", flag)); }
        else { actual_args.push(format!("-XX:+{}", flag)); }
    }

    let builder_args = instance.build_arguments(&version_ref, &profile.username, &profile.uuid, &HashMap::new(), &HashSet::new(), &HashMap::new(), &HashSet::new(), &Vec::new());
    let mut skip_next = false;
    for arg in builder_args {
        if skip_next { skip_next = false; continue; }
        if arg == "--gameDir" { skip_next = true; continue; }
        if arg.contains("runtime") { continue; }
        let s: &str = &arg;
        if !s.starts_with("-Xmx") && !s.starts_with("-Xms") && !s.starts_with("-Dfabric.addMods") && !s.contains("Unlock") { 
            actual_args.push(arg); 
        }
    }
    
    actual_args.push("--gameDir".into());
    actual_args.push(mc_dir.to_string_lossy().to_string());
    
    let mut child = tokio::process::Command::new(java_binary)
        .args(actual_args)
        .current_dir(&mc_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let h1 = app.clone(); tauri::async_runtime::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await { let _ = h1.emit("minecraft-log", line); }
    });
    let h2 = app.clone(); tauri::async_runtime::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await { let _ = h2.emit("minecraft-log", format!("[ERROR] {}", line)); }
    });

    let key = format!("{}:{}", version, profile.username);
    INSTANCES.lock().await.insert(key.clone(), child);

    let h3 = app.clone(); tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let mut inst = INSTANCES.lock().await;
            if let Some(c) = inst.get_mut(&key) {
                if let Ok(Some(s)) = c.try_wait() {
                    let _ = h3.emit("minecraft-log", format!("[INFO] Game session ended: {}", s));
                    inst.remove(&key); break;
                }
            } else { break; }
        }
    });

    let _ = app.emit("instances-changed", ());
    Ok(())
}

#[tauri::command]
pub async fn repair_client(repair_type: String, custom_dir: Option<String>) -> Result<(), String> {
    let base_dir = client_dir_for(custom_dir.as_deref());
    let mc_dir = base_dir.join("profiles");
    match repair_type.as_str() {
        "all" => { let _ = tokio::fs::remove_dir_all(&base_dir).await; },
        _ => { let _ = tokio::fs::remove_dir_all(&mc_dir.join("mods")).await; }
    }
    Ok(())
}
