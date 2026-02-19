use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use anyhow::Context;

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
struct VersionManifest {
    fabric_loader: String,
    #[allow(dead_code)]
    fabric_api: Option<String>,
    mods: Vec<ModEntry>,
}

#[derive(Debug, Deserialize)]
struct ModList {
    #[serde(default)]
    pub client_name: Option<String>,
    pub versions: HashMap<String, VersionManifest>,
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

async fn fetch_modlist(url: &str) -> anyhow::Result<ModList> {
    let client = reqwest::Client::builder()
        .user_agent("NanoClient/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let resp = client.get(url).send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("HTTP {} fetching modlist", resp.status());
    }
    let text = resp.text().await?;
    let list: ModList = serde_json::from_str(&text)
        .context("Failed to parse modlist.json — check JSON format")?;
    Ok(list)
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

async fn download_fabric_installer(client_dir: &Path, app: &AppHandle) -> anyhow::Result<PathBuf> {
    let installer_url = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar";
    let installer_path = client_dir.join("fabric-installer.jar");
    download_file(installer_url, &installer_path, "fabric-installer.jar", app).await?;
    Ok(installer_path)
}

fn detect_java(java_path_override: Option<&str>, java_version: u8) -> String {
    if let Some(p) = java_path_override {
        if !p.is_empty() && Path::new(p).exists() {
            return p.to_string();
        }
    }

    // Common paths on Linux / macOS / Windows
    let candidates: Vec<String> = vec![
        format!("/usr/lib/jvm/java-{java_version}-openjdk/bin/java"),
        format!("/usr/lib/jvm/java-{java_version}-openjdk-amd64/bin/java"),
        format!("/usr/lib/jvm/java-{java_version}/bin/java"),
        "/usr/bin/java".to_string(),
        "java".to_string(), // rely on PATH
    ];

    for c in &candidates {
        if c == "java" || Path::new(c).exists() {
            return c.clone();
        }
    }
    "java".to_string()
}

async fn install_fabric(
    java: &str,
    installer_jar: &Path,
    mc_version: &str,
    loader_version: &str,
    mc_dir: &Path,
    app: &AppHandle,
) -> anyhow::Result<()> {
    let _ = app.emit("download-progress", DownloadProgress {
        file: format!("Installing Fabric for {mc_version}..."),
        current: 0,
        total: 1,
    });

    let status = tokio::process::Command::new(java)
        .arg("-jar")
        .arg(installer_jar)
        .arg("client")
        .arg("-mcversion")
        .arg(mc_version)
        .arg("-loader")
        .arg(loader_version)
        .arg("-dir")
        .arg(mc_dir)
        .arg("-noprofile")
        .status()
        .await?;

    if !status.success() {
        anyhow::bail!("Fabric installer exited with code {:?}", status.code());
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────
// Tauri commands
// ─────────────────────────────────────────────────────────

/// Fetch the mod list for a specific MC version from GitHub
#[tauri::command]
pub async fn fetch_mods_for_version(
    version: String,
    url: String,
) -> Result<Vec<ModEntry>, String> {
    let list = fetch_modlist(&url).await.map_err(|e| e.to_string())?;
    let mut mods = list
        .versions
        .get(&version)
        .map(|v| v.mods.clone())
        .unwrap_or_default();
    
    // Post-process to ensure filename and id are set
    for m in mods.iter_mut() {
        if m.filename.is_empty() {
            m.filename = m.name.clone();
        }
        if m.id.is_empty() {
            m.id = m.name.to_lowercase().replace(".jar", "").replace(" ", "-");
        }
    }
    
    Ok(mods)
}

/// Returns the default client directory path
#[tauri::command]
pub fn get_client_dir(custom_dir: Option<String>) -> String {
    client_dir_for(custom_dir.as_deref())
        .to_string_lossy()
        .to_string()
}

/// Full flow: fetch modlist → download mods → install Fabric → launch Minecraft
#[tauri::command]
pub async fn prepare_and_launch(
    app: AppHandle,
    version: String,
    username: String,
    ram_gb: u32,
    java_path: Option<String>,
    extra_jvm_args: Option<String>,
    modlist_url: String,
    client_dir: Option<String>,
) -> Result<(), String> {
    prepare_and_launch_inner(
        app, version, username, ram_gb, java_path, extra_jvm_args, modlist_url, client_dir
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
    modlist_url: String,
    client_dir: Option<String>,
) -> anyhow::Result<()> {
    let base_dir = client_dir_for(client_dir.as_deref());
    let mods_dir = base_dir.join("mods").join(&version);
    let mc_dir = base_dir.join("minecraft");

    // Ensure directories
    tokio::fs::create_dir_all(&mods_dir).await?;
    tokio::fs::create_dir_all(&mc_dir).await?;

    // 1. Fetch modlist
    let _ = app.emit("download-progress", DownloadProgress {
        file: "Fetching mod list from GitHub...".to_string(),
        current: 0, total: 1,
    });
    let modlist = fetch_modlist(&modlist_url).await?;
    let version_data = modlist.versions.get(&version)
        .context(format!("Version {version} not found in modlist.json"))?;
    let fabric_loader = &version_data.fabric_loader;

    // Java version: 1.20.x uses 17, 1.21+ uses 21
    let java_ver: u8 = if version.starts_with("1.20") { 17 } else { 21 };
    let java = detect_java(java_path.as_deref(), java_ver);

    // 2. Download mods
    let mut mods_to_download = version_data.mods.clone();
    for m in mods_to_download.iter_mut() {
        if m.filename.is_empty() {
            m.filename = m.name.clone();
        }
    }

    let total_mods = mods_to_download.len();
    for (i, mod_entry) in mods_to_download.iter().enumerate() {
        let dest = mods_dir.join(&mod_entry.filename);
        let _ = app.emit("download-progress", DownloadProgress {
            file: format!("[{}/{}] {}", i + 1, total_mods, mod_entry.name),
            current: i as u64,
            total: total_mods as u64,
        });
        download_file(&mod_entry.url, &dest, &mod_entry.filename, &app).await
            .with_context(|| format!("Failed to download {}", mod_entry.name))?;
    }

    // 3. Download and install Fabric
    let installer = download_fabric_installer(&base_dir, &app).await?;
    install_fabric(&java, &installer, &version, fabric_loader, &mc_dir, &app).await?;

    // 4. Copy mods to minecraft mods folder
    let mc_mods_dir = mc_dir.join("mods");
    tokio::fs::create_dir_all(&mc_mods_dir).await?;
    for mod_entry in &mods_to_download {
        let src = mods_dir.join(&mod_entry.filename);
        let dst = mc_mods_dir.join(&mod_entry.filename);
        if src.exists() && !dst.exists() {
            tokio::fs::copy(&src, &dst).await?;
        }
    }

    // 5. Launch Minecraft with Fabric profile
    let _ = app.emit("download-progress", DownloadProgress {
        file: format!("Starting Minecraft {version}..."),
        current: 1, total: 1,
    });

    let ram_arg = format!("-Xmx{}G", ram_gb);
    let ram_min_arg = format!("-Xms{}G", (ram_gb / 2).max(1));

    let mut jvm_args: Vec<String> = vec![
        ram_arg, ram_min_arg,
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+UseZGC".to_string(),
        "-XX:+ZGenerational".to_string(),
        "-XX:+AlwaysPreTouch".to_string(),
        "-XX:+DisableExplicitGC".to_string(),
        "-Xss4M".to_string(),
        "-Dfile.encoding=UTF-8".to_string(),
    ];

    if let Some(extra) = &extra_jvm_args {
        for arg in extra.split_whitespace() {
            jvm_args.push(arg.to_string());
        }
    }

    // Build the Fabric profile launch command using minecraft-launcher compatible args
    // The profile is named "fabric-loader-<version>-<mc_version>" by Fabric installer
    let profile_name = format!("fabric-loader-{fabric_loader}-{version}");

    // Determine OS-specific launcher
    #[cfg(target_os = "windows")]
    let launcher = mc_dir.join("minecraft-launcher.exe");
    #[cfg(not(target_os = "windows"))]
    let launcher = {
        // Try official Minecraft launcher first, fallback to java -jar
        let official = mc_dir.join("minecraft-launcher");
        if official.exists() { official }
        else {
            // Fallback: launch via java with Fabric's main class
            // For a real integration you would use MCLC-compatible call
            PathBuf::from("java")
        }
    };

    let mut cmd = tokio::process::Command::new(&launcher);
    cmd.arg("--username").arg(&username)
       .arg("--version").arg(&profile_name)
       .arg("--gameDir").arg(&mc_dir)
       .arg("--assetsDir").arg(mc_dir.join("assets"))
       .arg("--accessToken").arg("0") // offline mode
       .arg("--userType").arg("legacy");
    cmd.env("JAVA_OPTS", jvm_args.join(" "));

    cmd.spawn()?;
    Ok(())
}
