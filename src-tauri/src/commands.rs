use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use anyhow::Context;
use once_cell::sync::Lazy;
use directories::ProjectDirs;
use tokio::sync::Mutex;

static INSTANCES: Lazy<Mutex<HashMap<String, tokio::process::Child>>> = Lazy::new(|| Mutex::new(HashMap::new()));

use lighty_launcher::prelude::*;
use lighty_launcher::event::{EventBus, Event};
use lighty_launcher::auth::OfflineAuth;
use lighty_launcher::java::JavaRuntime;
use lighty_launcher::java::jre_downloader;
use lighty_launcher::launch::Installer;
use lighty_launcher::loaders::{LoaderExtensions, VersionInfo, VersionMetaData};
use lighty_launcher::launch::LaunchArguments;
// use std::io::Read;
static LAUNCHER_DIRS: Lazy<ProjectDirs> = Lazy::new(|| {
    ProjectDirs::from("com", "nanoclient", "launcher")
        .expect("Failed to get project directories")
});

// ─────────────────────────────────────────────────────────
// GitHub API configuration for private repo
// ─────────────────────────────────────────────────────────
const GITHUB_API_BASE: &str = "https://api.github.com/repos/Fami-PL/nano-client-api/contents";
const GITHUB_TOKEN: &str = "";

// ─────────────────────────────────────────────────────────
// Types mirroring the frontend store & modlist.json schema
// ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub filename: String,
    pub url: String,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub required: bool,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

fn default_category() -> String {
    "utility".to_string()
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct VersionManifest {
    fabric_loader: String,
    fabric_api: Option<String>,
    mods: Vec<ModEntry>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ModList {
    #[serde(default)]
    pub client_name: Option<String>,
    pub versions: HashMap<String, VersionManifest>,
}

fn parse_mods_from_json(json: &serde_json::Value) -> Vec<ModEntry> {
    let mut mods = Vec::new();
    if let Some(mods_raw) = json.get("mods").and_then(|m| m.as_array()) {
        for m in mods_raw {
            let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let file = m.get("file").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let url = m.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
            
            // Try to get category from JSON, or guess it
            let mut category = m.get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
            
            if category.is_empty() {
                let lower_name = name.to_lowercase();
                if lower_name.contains("sodium") || lower_name.contains("lithium") || 
                   lower_name.contains("optimization") || lower_name.contains("starlight") ||
                   lower_name.contains("performance") || lower_name.contains("fps") ||
                   lower_name.contains("c2me") || lower_name.contains("ferritecore") ||
                   lower_name.contains("immediatelyfast") || lower_name.contains("krypton") ||
                   lower_name.contains("iris") || lower_name.contains("culling") {
                    category = "performance".into();
                } else if lower_name.contains("menu") || lower_name.contains("visual") ||
                          lower_name.contains("animation") || lower_name.contains("skin") ||
                          lower_name.contains("zoom") || lower_name.contains("hud") ||
                          lower_name.contains("dark") || lower_name.contains("blur") {
                    category = "visual".into();
                } else if lower_name.contains("api") || lower_name.contains("library") ||
                          lower_name.contains("lib") || lower_name.contains("config") ||
                          lower_name.contains("yacl") || lower_name.contains("architectury") {
                    category = "library".into();
                } else {
                    category = "utility".into();
                }
            }

            mods.push(ModEntry {
                id: "".into(), // Will be fixed below
                name: name.clone(),
                filename: file,
                url,
                sha256: None,
                required: true,
                category,
                description: m.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                size: m.get("size_bytes").and_then(|v| v.as_u64()),
            });
        }
    }

    // Ensure IDs and Filenames
    for m in mods.iter_mut() {
        if m.filename.is_empty() {
            m.filename = m.name.clone();
        }
        if m.id.is_empty() {
            m.id = m.name.to_lowercase().replace(".jar", "").replace(" ", "-");
        }
    }
    mods
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub file: String,
    pub current: u64,
    pub total: u64,
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

fn default_client_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".nanoclient")
}

fn client_dir_for(custom: Option<&str>) -> PathBuf {
    match custom {
        Some(s) if !s.is_empty() => {
            if s.starts_with('~') {
                dirs::home_dir()
                    .unwrap_or_default()
                    .join(&s[2..])
            } else {
                PathBuf::from(s)
            }
        }
        _ => default_client_dir(),
    }
}

#[allow(dead_code)]
async fn fetch_modlist(url: &str) -> anyhow::Result<ModList> {
    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let request = if url.contains("api.github.com") && GITHUB_TOKEN != "ghp_YOUR_PRIVATE_TOKEN_HERE" {
        client.get(url)
            .header("Authorization", format!("token {}", GITHUB_TOKEN))
            .header("Accept", "application/vnd.github.v3.raw")
    } else {
        client.get(url)
    };
    
    let resp = request.send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("HTTP {} fetching modlist", resp.status());
    }
    let text = resp.text().await?;
    let list: ModList = serde_json::from_str(&text)
        .context("Failed to parse modlist.json — check JSON format")?;
    Ok(list)
}

async fn download_github_file(path: &str) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .build()?;
    
    let url = format!("{}/{}", GITHUB_API_BASE, path);
    let mut request = client.get(&url);
    
    if GITHUB_TOKEN != "ghp_YOUR_PRIVATE_TOKEN_HERE" {
        request = request.header("Authorization", format!("token {}", GITHUB_TOKEN));
    }
    
    let resp = request
        .header("Accept", "application/vnd.github.v3.raw")
        .send().await?;
        
    if !resp.status().is_success() {
        anyhow::bail!("GitHub API error: {} at {}", resp.status(), url);
    }
    
    Ok(resp.bytes().await?.to_vec())
}

// ─────────────────────────────────────────────────────────
// Modrinth API structures
// ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthSearchResponse {
    pub hits: Vec<ModrinthSearchResult>,
    pub total_hits: u32,
    pub offset: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthSearchResult {
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub author: String,
    pub categories: Vec<String>,
    pub display_categories: Option<Vec<String>>,
    pub downloads: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthVersion {
    pub id: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModrinthFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveInstance {
    pub version: String,
    pub username: String,
}

#[tauri::command]
pub async fn get_active_instances() -> Vec<ActiveInstance> {
    let instances = INSTANCES.lock().await;
    instances.keys().map(|k| {
        let parts: Vec<&str> = k.split(':').collect();
        ActiveInstance {
            version: parts.get(0).unwrap_or(&"unknown").to_string(),
            username: parts.get(1).unwrap_or(&"unknown").to_string(),
        }
    }).collect()
}

#[tauri::command]
pub async fn kill_instance(version: String, username: String) -> Result<(), String> {
    let key = format!("{}:{}", version, username);
    let mut instances = INSTANCES.lock().await;
    if let Some(mut child) = instances.remove(&key) {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn search_modrinth(
    query: String, 
    mc_version: String, 
    offset: u32, 
    limit: u32,
    index: String // "relevance", "downloads", "newest", "updated"
) -> Result<ModrinthSearchResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .build().map_err(|e| e.to_string())?;

    let facets = format!(
        "[[\"categories:fabric\"],[\"versions:{}\"],[\"project_type:mod\"]]",
        mc_version
    );
    
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets={}&offset={}&limit={}&index={}",
        urlencoding::encode(&query),
        urlencoding::encode(&facets),
        offset,
        limit,
        index
    );

    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let data: ModrinthSearchResponse = resp.json().await.map_err(|e| e.to_string())?;
    
    Ok(data)
}

#[tauri::command]
pub async fn install_modrinth_mod(
    app: AppHandle,
    project_id: String,
    mc_version: String,
    custom_dir: Option<String>
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .build().map_err(|e| e.to_string())?;

    // 1. Get versions for project
    let url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let versions: Vec<ModrinthVersion> = resp.json().await.map_err(|e| e.to_string())?;

    // 2. Find compatible version
    let best_version = versions.into_iter().find(|v| {
        v.game_versions.contains(&mc_version) && v.loaders.contains(&"fabric".to_string())
    }).ok_or_else(|| format!("No compatible Fabric version found for {}", mc_version))?;

    let file = best_version.files.iter().find(|f| f.primary).or(best_version.files.first())
        .ok_or_else(|| "No files found in the latest compatible version".to_string())?;

    // 3. Download to mods root (player folder)
    let base_dir = client_dir_for(custom_dir.as_deref());
    let mods_root = base_dir.join("mods").join(&mc_version);
    tokio::fs::create_dir_all(&mods_root).await.map_err(|e| e.to_string())?;
    
    let dest = mods_root.join(&file.filename);
    download_file(&file.url, &dest, &file.filename, &app).await.map_err(|e| e.to_string())?;
    
    let _ = app.emit("minecraft-log", format!("[INFO] Installed mod {} via Modrinth", file.filename));
    Ok(())
}

async fn download_file(
    url: &str,
    dest: &Path,
    filename: &str,
    app: &AppHandle,
) -> anyhow::Result<()> {
    use futures_util::StreamExt;

    if dest.exists() {
        return Ok(()); // already downloaded
    }

    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let resp = client.get(url).send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("HTTP {} downloading {}", resp.status(), filename);
    }

    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let mut current: u64 = 0;

    let tmp = dest.with_extension("tmp");
    let mut file = tokio::fs::File::create(&tmp).await?;

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        current += bytes.len() as u64;
        file.write_all(&bytes).await?;
        let _ = app.emit("download-progress", DownloadProgress {
            file: filename.to_string(),
            current,
            total,
        });
    }
    file.flush().await?;
    drop(file);
    tokio::fs::rename(&tmp, dest).await?;
    Ok(())
}

// ─────────────────────────────────────────────────────────
// Tauri commands
// ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_mods_for_version(
    version: String,
) -> Result<Vec<ModEntry>, String> {
    // 1. Check Local
    let current_dir = std::env::current_dir().unwrap_or_default();
    let root_dir = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap_or(&current_dir).to_path_buf()
    } else {
        current_dir
    };
    let local_path = root_dir.join("minecraft_mods_json").join(&version).join(format!("{}-Mods.json", version));

    if local_path.exists() {
        let content = std::fs::read_to_string(&local_path).map_err(|e| e.to_string())?;
        let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(parse_mods_from_json(&json));
    }

    // 2. Check GitHub API
    let api_path = format!("{}/{}-Mods.json", version, version);
    match download_github_file(&api_path).await {
        Ok(content) => {
            let json: serde_json::Value = serde_json::from_str(&String::from_utf8_lossy(&content)).map_err(|e| e.to_string())?;
            Ok(parse_mods_from_json(&json))
        }
        Err(e) => Err(format!("Failed to fetch mods from GitHub: {e}")),
    }
}

#[tauri::command]
pub fn get_client_dir(custom_dir: Option<String>) -> String {
    client_dir_for(custom_dir.as_deref())
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn prepare_and_launch(
    app: AppHandle,
    version: String,
    username: String,
    ram_gb: u32,
    java_path: Option<String>,
    extra_jvm_args: Option<String>,
    client_dir: Option<String>,
) -> Result<(), String> {
    prepare_and_launch_inner(
        app, version, username, ram_gb, java_path, extra_jvm_args, client_dir
    )
    .await
    .map_err(|e| e.to_string())
}

async fn prepare_and_launch_inner(
    app: AppHandle,
    version: String,
    username: String,
    ram_gb: u32,
    java_path: Option<String>,
    extra_jvm_args: Option<String>,
    client_dir: Option<String>,
) -> anyhow::Result<()> {
    let base_dir = client_dir_for(client_dir.as_deref());
    let java_dir = base_dir.join("java");
    let libraries_dir = base_dir.join("libraries");
    let assets_dir = base_dir.join("assets");
    let mc_dir = base_dir.join("profiles"); // Shared profile for all versions
    let versions_dir = mc_dir.join("versions"); // Shared Client JARs
    let mods_root = base_dir.join("mods").join(&version);
    let preinstalled_mods_dir = mods_root.join("preinstalled"); // No dot as requested
    
    tokio::fs::create_dir_all(&java_dir).await?;
    tokio::fs::create_dir_all(&libraries_dir).await?;
    tokio::fs::create_dir_all(&assets_dir).await?;
    tokio::fs::create_dir_all(&versions_dir).await?;
    tokio::fs::create_dir_all(&mc_dir).await?;
    tokio::fs::create_dir_all(&preinstalled_mods_dir).await?;
    tokio::fs::create_dir_all(&mc_dir.join("saves")).await?;
    tokio::fs::create_dir_all(&mc_dir.join("resourcepacks")).await?;

    // 1. Modlist/Manifest loading
    let _ = app.emit("download-progress", DownloadProgress {
        file: "Loading mod configuration...".into(),
        current: 0,
        total: 1,
    });
    let _ = app.emit("minecraft-log", format!("[INFO] Initializing launch for version {}", version));

    // Check for local version-specific mods.json first
    let current_dir = std::env::current_dir()?;
    let root_dir = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap_or(&current_dir).to_path_buf()
    } else {
        current_dir.to_path_buf()
    };
    
    let local_json_dir = root_dir.join("minecraft_mods_json").join(&version);
    let local_json_path = local_json_dir.join(format!("{}-Mods.json", version));
    let mut fabric_loader_ver = "0.18.1".to_string(); // Default fallback for 1.21+

    let version_data_mods = if local_json_path.exists() {
        let _ = app.emit("minecraft-log", format!("[INFO] Mod configuration: LOCAL ({:?})", local_json_path));
        let content = tokio::fs::read_to_string(&local_json_path).await?;
        let local_manifest: serde_json::Value = serde_json::from_str(&content)?;
        
        if let Some(meta) = local_manifest.get("metadata") {
            if let Some(fl) = meta.get("fabric_loader").and_then(|v| v.as_str()) {
                fabric_loader_ver = fl.to_string();
            }
        }

        parse_mods_from_json(&local_manifest)
    } else {
        let api_path = format!("{}/{}-Mods.json", version, version);
        let _ = app.emit("minecraft-log", format!("[INFO] Mod configuration: GITHUB API ({})", api_path));
        
        let content = download_github_file(&api_path).await?;
        let local_manifest: serde_json::Value = serde_json::from_str(&String::from_utf8(content)?)?;
        
        if let Some(meta) = local_manifest.get("metadata") {
            if let Some(fl) = meta.get("fabric_loader").and_then(|v| v.as_str()) {
                fabric_loader_ver = fl.to_string();
            }
        }

        let mods = parse_mods_from_json(&local_manifest);
        let _ = app.emit("minecraft-log", format!("[INFO] Loaded {} mods from GitHub API", mods.len()));
        mods
    };

    // Fabric loader version is now strictly 0.18.1 across all versions in JSONs

    // 2. EventBus setup
    let event_bus = EventBus::new(200);
    let mut receiver = event_bus.subscribe();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.next().await {
            match event {
                Event::Launch(LaunchEvent::InstallProgress { bytes }) => {
                    let _ = app_clone.emit("download-progress", DownloadProgress {
                        file: "Installing...".into(),
                        current: bytes,
                        total: 0,
                    });
                }
                Event::Launch(LaunchEvent::InstallStarted { total_bytes, .. }) => {
                    let _ = app_clone.emit("minecraft-log", format!("[INFO] Installation started (Total: {} MB)", total_bytes / 1024 / 1024));
                    let _ = app_clone.emit("download-progress", DownloadProgress {
                        file: "Starting installation...".into(),
                        current: 0,
                        total: total_bytes,
                    });
                }
                Event::Launch(LaunchEvent::InstallCompleted { .. }) => {
                    let _ = app_clone.emit("minecraft-log", "[INFO] Installation finished");
                    let _ = app_clone.emit("download-progress", DownloadProgress {
                        file: "Installation finished".into(),
                        current: 1,
                        total: 1,
                    });
                }
                Event::Launch(LaunchEvent::Launching { .. }) => {
                    let _ = app_clone.emit("minecraft-log", "[INFO] Launching game process...");
                    let _ = app_clone.emit("download-progress", DownloadProgress {
                        file: "Launching game...".into(),
                        current: 0,
                        total: 1,
                    });
                }
                Event::Java(JavaEvent::JavaAlreadyInstalled { binary_path, .. }) => {
                    let _ = app_clone.emit("minecraft-log", format!("Java found at: {}", binary_path));
                }
                Event::Java(JavaEvent::JavaNotFound { .. }) => {
                    let _ = app_clone.emit("minecraft-log", "Java not found, downloading...");
                }
                _ => {}
            }
        }
    });

    // 3. Builder
    // Use "versions/{version}" to force the launcher to put JARs in the versions folder
    let mut instance = VersionBuilder::new(
        &format!("versions/{}", version), 
        Loader::Fabric, 
        &fabric_loader_ver, 
        &version, 
        &LAUNCHER_DIRS
    )
    .with_custom_game_dir(mc_dir.clone())
    .with_custom_java_dir(java_dir);

    if let Some(p) = java_path.filter(|p| !p.is_empty() && Path::new(p).exists()) {
        instance = instance.with_custom_java_dir(PathBuf::from(p));
    }

    // 4. Auth
    let mut auth = OfflineAuth::new(&username);
    let profile = auth.authenticate(Some(&event_bus)).await
        .map_err(|e| anyhow::anyhow!("Auth failed: {}", e))?;

    // 5. Install Fabric + Vanilla
    let metadata: std::sync::Arc<VersionMetaData> = instance.get_fabric_complete().await
        .map_err(|e| anyhow::anyhow!("Failed to fetch Fabric metadata: {}", e))?;
    
    let version_ref = if let VersionMetaData::Version(v) = &*metadata {
        v
    } else {
        anyhow::bail!("Invalid metadata");
    };

    instance.install(&version_ref, Some(&event_bus)).await
        .context("Fabric/MC installation failed")?;

    // 6. Ensure Java version based on Minecraft version
    let mut java_major_version = version_ref.java_version.major_version;
    
    if version.starts_with("1.20") {
        java_major_version = 17;
        let _ = app.emit("minecraft-log", "[INFO] Selecting Java 17 for Minecraft 1.20.x");
    } else if version.starts_with("1.21") {
        java_major_version = 21;
        let _ = app.emit("minecraft-log", "[INFO] Selecting Java 21 for Minecraft 1.21.x");
    }

    let java_binary = if let Ok(path) = jre_downloader::find_java_binary(
        instance.java_dirs(), 
        &JavaDistribution::Temurin, 
        &java_major_version
    ).await {
        path
    } else {
        jre_downloader::jre_download(
            instance.java_dirs(),
            &JavaDistribution::Temurin,
            &java_major_version,
            |_, _| {},
            Some(&event_bus)
        ).await.map_err(|e| anyhow::anyhow!("Java download failed: {}", e))?
    };

    // 7. Custom mods
    let _ = app.emit("minecraft-log", "[INFO] Checking required mods...");
    
    // Symlink profiles/mods -> mods/[VERSION]
    let game_mods_dir = mc_dir.join("mods");
    if game_mods_dir.exists() {
        if game_mods_dir.is_symlink() {
            let _ = std::fs::remove_file(&game_mods_dir);
        } else if game_mods_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&game_mods_dir) {
                for entry in entries.flatten() {
                    let dest = mods_root.join(entry.file_name());
                    if !dest.exists() { let _ = std::fs::rename(entry.path(), dest); }
                }
            }
            let _ = std::fs::remove_dir_all(&game_mods_dir);
        }
    }
    
    #[cfg(unix)]
    let _ = std::os::unix::fs::symlink(&mods_root, &game_mods_dir);

    for mod_entry in &version_data_mods {
        let filename = if mod_entry.filename.is_empty() { &mod_entry.name } else { &mod_entry.filename };
        let dest = preinstalled_mods_dir.join(filename);

        if !dest.exists() && !mod_entry.url.is_empty() {
            download_file(&mod_entry.url, &dest, filename, &app).await?;
        }
    }
    
    if let Ok(entries) = std::fs::read_dir(&preinstalled_mods_dir) {
        let _ = app.emit("minecraft-log", format!("[INFO] All mods verified ({})", entries.count()));
    }

    // 8. Launch preparation
    let mut jvm_set = HashSet::new();
    jvm_set.insert("XX:+UnlockExperimentalVMOptions".to_string());
    jvm_set.insert("XX:+AlwaysPreTouch".to_string());
    jvm_set.insert("XX:+DisableExplicitGC".to_string());

    // ZGC optimization - Generational is only for Java 21+
    if java_major_version >= 21 {
        jvm_set.insert("XX:+UseZGC".to_string());
        jvm_set.insert("XX:+ZGenerational".to_string());
    } else {
        // For Java 17, standard ZGC or G1 is better
        jvm_set.insert("XX:+UseG1GC".to_string());
    }

    if let Some(extra) = extra_jvm_args {
        for arg in extra.split_whitespace() {
            let arg_clean = arg.trim_start_matches('-');
            // Filter out flags that are strictly Java 21+ if we are on 17
            if java_major_version < 21 && arg_clean.contains("ZGenerational") {
                let _ = app.emit("minecraft-log", "[WARN] Skipping -XX:+ZGenerational (requires Java 21+)");
                continue;
            }
            jvm_set.insert(arg_clean.to_string());
        }
    }

    // JVM properties and RAM
    let mut jvm_overrides = HashMap::new();
    jvm_overrides.insert("Xmx".to_string(), format!("{}G", ram_gb));
    jvm_overrides.insert("Xms".to_string(), format!("{}G", (ram_gb / 2).max(1)));
    jvm_overrides.insert("Xss".to_string(), "4M".to_string());
    jvm_overrides.insert("Dfile.encoding".to_string(), "UTF-8".to_string());

    // Build the final command arguments
    let final_args = instance.build_arguments(
        &version_ref,
        &profile.username,
        &profile.uuid,
        &HashMap::new(),
        &HashSet::new(),
        &jvm_overrides,
        &jvm_set,
        &Vec::new(),
    );

    // Filter and combine arguments correctly
    let mut actual_args = Vec::new();
    
    // Fabric mods loading - IMPORTANT: Fabric needs -Dfabric.addMods to see subfolders or extra folders
    actual_args.push(format!("-Dfabric.addMods={}:{}", preinstalled_mods_dir.to_string_lossy(), mods_root.to_string_lossy()));
    
    // Memory settings
    actual_args.push(format!("-Xmx{}G", ram_gb));
    actual_args.push(format!("-Xms{}G", (ram_gb / 2).max(1)));
    actual_args.push("-Xss4M".to_string());
    actual_args.push("-Dfile.encoding=UTF-8".to_string());
    
    // JVM Flags
    for flag in jvm_set {
        actual_args.push(format!("-{}", flag));
    }

    // Append everything from final_args, avoiding duplicates and ensuring -Dfabric.addMods isn't doubled
    for arg in final_args {
        if !arg.starts_with("-Xmx") && !arg.starts_with("-Xms") && !arg.starts_with("-Xss") && !arg.starts_with("-Dfabric.addMods") {
            actual_args.push(arg);
        }
    }
    
    let _ = app.emit("minecraft-log", format!("[INFO] Starting game process with {} arguments", actual_args.len()));

    // 9. Execute
    let java_runtime = JavaRuntime::new(java_binary);
    let mut child = java_runtime.execute(actual_args, instance.game_dirs()).await
        .map_err(|e| anyhow::anyhow!("Failed to launch game: {}", e))?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    let app_h = app.clone();
    tauri::async_runtime::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_h.emit("minecraft-log", line);
        }
    });

    let app_h2 = app.clone();
    tauri::async_runtime::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_h2.emit("minecraft-log", format!("[ERROR] {}", line));
        }
    });

    let key = format!("{}:{}", version, profile.username);
    {
        let mut instances = INSTANCES.lock().await;
        instances.insert(key.clone(), child);
    }

    // Spawn monitor
    let app_monitor = app.clone();
    let key_monitor = key.clone();
    tauri::async_runtime::spawn(async move {
        use std::time::Duration;
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            let exit_status = {
                let mut instances = INSTANCES.lock().await;
                let child = match instances.get_mut(&key_monitor) {
                    Some(c) => c,
                    None => return, // Already removed elsewhere (e.g. kill_instance)
                };

                match child.try_wait() {
                    Ok(Some(status)) => {
                        let _ = app_monitor.emit("minecraft-log", format!("[INFO] Game exited with status: {}", status));
                        instances.remove(&key_monitor);
                        Some(status)
                    }
                    Ok(None) => None, // Still running
                    Err(e) => {
                        let _ = app_monitor.emit("minecraft-log", format!("[ERROR] Error waiting for game process: {}", e));
                        instances.remove(&key_monitor);
                        return;
                    }
                }
            };

            if exit_status.is_some() {
                let _ = app_monitor.emit("instances-changed", ());
                break;
            }
        }
    });

    let _ = app.emit("instances-changed", ());
    Ok(())
}

#[tauri::command]
pub async fn repair_client(
    repair_type: String, // "mods", "fabric", "java", "all"
    custom_dir: Option<String>
) -> Result<(), String> {
    // Safety check: Don't allow repair while instances are running
    {
        let instances = INSTANCES.lock().await;
        if !instances.is_empty() {
            return Err("Cannot repair while Minecraft is running! Close the game first.".into());
        }
    }

    let base_dir = client_dir_for(custom_dir.as_deref());
    if !base_dir.exists() {
        return Ok(());
    }

    match repair_type.as_str() {
        "mods" => {
            let mods_dir = base_dir.join("mods");
            if mods_dir.exists() {
                tokio::fs::remove_dir_all(&mods_dir).await.map_err(|e| e.to_string())?;
            }
        },
        "fabric" => {
            // Removing libraries and profiles/versions forces reinstall
            let libs = base_dir.join("libraries");
            let versions = base_dir.join("profiles").join("versions");
            if libs.exists() { let _ = tokio::fs::remove_dir_all(&libs).await; }
            if versions.exists() { let _ = tokio::fs::remove_dir_all(&versions).await; }
        },
        "java" => {
            let java_dir = base_dir.join("java");
            if java_dir.exists() {
                tokio::fs::remove_dir_all(&java_dir).await.map_err(|e| e.to_string())?;
            }
        },
        "all" => {
            // Factory reset: wipe the whole client dir
            // We do this by iterating entries to avoid deleting the root if it's the home dir for some reason
            let mut entries = tokio::fs::read_dir(&base_dir).await.map_err(|e| e.to_string())?;
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.is_dir() {
                    let _ = tokio::fs::remove_dir_all(&path).await;
                } else {
                    let _ = tokio::fs::remove_file(&path).await;
                }
            }
        },
        _ => return Err("Invalid repair type".into())
    }

    Ok(())
}
