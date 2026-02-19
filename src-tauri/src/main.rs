// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Fix for Wayland/WebKitGTK protocol errors common on Linux (especially Arch/NVIDIA)
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    
    nano_client_lib::run()
}
