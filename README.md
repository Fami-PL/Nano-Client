<div align="center">
  <img src="https://raw.githubusercontent.com/Fami-PL/Nano-Client/main/src-tauri/icons/icon.png" width="128" height="128" alt="Nano Client Logo">
  
  # ⚡ Nano Client
  ### Premium & High-Performance Minecraft Launcher
  **Current Version: v1.1.0**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Platform: Linux](https://img.shields.io/badge/Platform-Linux-blue?logo=linux)](https://linux.org)
  [![Framework: Tauri](https://img.shields.io/badge/Framework-Tauri-FFC131?logo=tauri&logoColor=white)](https://tauri.app)
  [![Interface: React](https://img.shields.io/badge/UI-React-61DAFB?logo=react&logoColor=black)](https://react.dev)

  ---
  
  **Nano Client** is a state-of-the-art Minecraft launcher designed for maximum performance and a premium user experience. Built with **Rust** and **React** via Tauri, it provides a lightweight, secure, and lightning-fast alternative to traditional launchers.

</div>

## ✨ Key Features

- 💎 **Modern UI / UX**: Sleek blue-gradient design with glassmorphism, smooth animations, and a real-time dashboard.
- 🚀 **Performance Out-of-the-box**: Intelligent mod kategoryzation and pre-configured optimization stacks (Sodium, Lithium, Starlight).
- 📦 **Advanced Mod Manager**: 
    - Full **Modrinth integration** to browse and install new mods directly.
    - Automatic version-aware mod fetching.
    - One-click "Show on Modrinth" for installed mods to check for updates.
- 🛠️ **Maintenance & Repair System**: 
    - Dedicated repair cards to reinstall Mods, Fabric, or Java.
    - **Factory Reset** option to wipe and reinstall the whole client.
- 📡 **Active Instance Tracking**: Monitor and manage running game processes directly from the sidebar.
- ⚙️ **Power User Settings**: Tune RAM, JVM arguments (optimized for ZGC/G1GC), and custom Java paths.
- 🐧 **Linux First**: Native feel on Linux with high-performance rendering and system integration.

## 🚀 What's New in v1.1.0

- 🎯 **Advanced Instance Management**: Real-time tracking of running Minecraft processes in the sidebar with one-click termination.
- 🔥 **Extreme JVM Optimizations**:
    - **Generational ZGC** support for Java 21+ (minimal GC pauses).
    - Tuned **G1GC** parameters for Java 17.
    - Hardware acceleration & String Deduplication enabled by default.
- 💎 **Visual Polish**: Improved glassmorphism, smoother animations, and better UI responsiveness.
- 📦 **Binary Releases**: Native `.deb` and `.rpm` packages for easy installation.

## 📸 Screenshots

<img width="1046" height="654" alt="image" src="https://github.com/user-attachments/assets/a4d4850f-92bd-4f0c-b68f-326165551dcc" />


## 🚀 Getting Started

### Prerequisites
- [Rust Toolchain](https://rustup.rs/)
- [Node.js](https://nodejs.org/) (v18+)
- Tauri dependencies (see [Tauri Docs](https://tauri.app/v1/guides/getting-started/prerequisites))

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

## 🛠️ Project Structure

- `src/`: React frontend with Tailwind-inspired Vanilla CSS.
- `src-tauri/`: Rust backend handling process management, file I/O, and Minecraft protocol.
- `src/store/`: Zustand state management for persistent settings and logs.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  Built with ❤️ for the Minecraft Community
</div>
