<p align="center">
  <img src="./app-icon.png" alt="HomeBrew Manager Icon" width="128" height="128" />
</p>

<h1 align="center">HomeBrew Manager</h1>

<p align="center">
  A native, ultra-fast macOS desktop application designed to control Homebrew services, monitor background processes, and manage package upgrades.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS-black?style=flat-square&logo=apple" alt="macOS" />
  <img src="https://img.shields.io/badge/Backend-Tauri_v2_%2B_Rust-orange?style=flat-square&logo=rust" alt="Tauri Rust" />
  <img src="https://img.shields.io/badge/Frontend-React_19_%2B_Vite-blue?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## The Problem and The Solution

### The Problem
Homebrew is the standard package manager for macOS, but managing background services and staying updated is purely terminal-based:
- You need to type `brew services list` repeatedly to check what is running.
- There is no native visual view to see which service is consuming high CPU or memory.
- Checking outdated packages (`brew outdated`) is slow and freezes your terminal workflow.
- Starting, stopping, and inspecting services requires repetitive terminal commands.

### The Solution
HomeBrew Manager bridges the gap with a high-performance native desktop companion:
- **Instant visibility**: See all active services, statuses, and process IDs at a glance.
- **Resource intelligence**: Track live CPU and RAM consumption for each running service.
- **One-click upgrades**: Inspect outdated packages with cached instant queries and update them with one click.
- **Zero bloat**: Built on Tauri v2 and Rust, keeping memory usage tiny compared to Electron apps.

---

## Key Features

| Feature | Description |
|---|---|
| **Services Control** | Start, stop, and restart background services with one click. |
| **Active Resource Monitor** | Real-time CPU (%) and RAM tracking per service PID. |
| **Software Upgrades** | View outdated packages instantly using pre-computed background caching. |
| **Package Search** | Search Homebrew formulae and casks, inspect metadata, and install. |
| **Background Bootstrap Engine** | Zero cold-start delay. Queries system state safely at launch. |
| **System Notifications** | Native macOS alerts for service status changes and upgrades. |
| **Safety First** | Strict command validation. Prevents shell injection and accidental removals. |

---

## Installation

Choose either of the two installation methods below:

### Option 1: Single Terminal Command (Recommended)

Run this single command in your macOS Terminal. It downloads the latest DMG, installs the application to `/Applications`, clears the macOS quarantine flag, and launches the app automatically:

```bash
/bin/bash -c "$(curl -fsSL https://homebrew.galerin.in/install.sh)"
```

---

### Option 2: Build From Source

Follow these steps to clone and build locally on your Mac:

#### Prerequisites
- macOS (Apple Silicon or Intel)
- [Homebrew](https://brew.sh) installed
- [Node.js](https://nodejs.org) (v18+) and [pnpm](https://pnpm.io)
- [Rust](https://www.rust-lang.org) toolchain installed (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

#### Build Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mohit0224/homebrew-manager.git
   cd homebrew-manager
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build the native DMG installer**:
   ```bash
   pnpm run build
   ```

4. **Install the application**:
   Once the build completes, find the DMG in:
   ```text
   dist-installer/HomeBrew Manager.dmg
   ```
   Open the DMG file and drag **HomeBrew Manager.app** into your `/Applications` folder.

---

## Tech Stack

- **Core Framework**: [Tauri v2](https://v2.tauri.app)
- **Native Backend**: Rust (`sysinfo`, `tokio`, `regex`, `serde`)
- **Frontend Framework**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Packaging**: macOS DMG bundle with ad-hoc code signing

---

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open an issue or submit a pull request.
