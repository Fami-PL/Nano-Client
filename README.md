<div align="center">
  <img src="https://raw.githubusercontent.com/Fami-PL/Nano-Client/main/src-tauri/icons/icon.png" width="128" height="128" alt="Nano Client Logo">
  
  # ⚡ Nano Client
  ### Modern & High-Performance Minecraft Launcher
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Platform: Arch Linux](https://img.shields.io/badge/Platform-Arch_Linux-blue?logo=arch-linux)](https://archlinux.org)
  [![Framework: Tauri](https://img.shields.io/badge/Framework-Tauri-FFC131?logo=tauri&logoColor=white)](https://tauri.app)
  [![Interface: React](https://img.shields.io/badge/UI-React-61DAFB?logo=react&logoColor=black)](https://react.dev)

  ---
  
  **Nano Client** is a state-of-the-art Minecraft launcher designed for maximum FPS and a premium user experience. Built with **Rust** and **React** via Tauri, it provides a lightweight and lightning-fast alternative to traditional launchers.

</div>

## ✨ Key Features

- 💎 **Modern UI**: Sleek blue-gradient design with glassmorphism and smooth animations.
- 🚀 **FPS Focused**: Pre-configured with 40+ optimization mods including Sodium, Lithium, and FerriteCore.
- 📦 **Dynamic Mod Management**: Automatically fetches and updates mods from a GitHub-hosted JSON manifest.
- 🛠️ **Fabric Integration**: Supports multiple versions (1.20.1 - 1.21.10) with automatic Fabric loader installation.
- 🐧 **Linux Optimized**: Specifically tailored for Arch Linux with built-in fixes for Wayland and WebKit.
- ⚙️ **Advanced Settings**: Customize RAM allocation, JVM arguments (ZGC recommended), and custom Java paths.

## 📸 Screenshots

*(Add screenshots here)*

## 🚀 Getting Started

### Prerequisites
- [Rust Toolchain](https://rustup.rs/)
- [Node.js](https://nodejs.org/) (v18+)
- WebKit2GTK (for Linux)

### Installation (Development)
1. Clone the repository:
   ```bash
   git clone https://github.com/Fami-PL/Nano-Client.git
   cd Nano-Client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the client:
   ```bash
   npm run tauri dev
   ```

## 🛠️ Mod List JSON Configuration
The client fetches its mod list from `modlist.json` in this repository. You can modify this file to add or update mods, and the changes will reflect in the launcher for everyone using your manifest link.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  Built with ❤️ for the Minecraft Community
</div>
