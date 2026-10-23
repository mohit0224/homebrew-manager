# HomeBrew Manager - Architecture and Design Plan

## 1. System Overview

A macOS desktop application built with Electron, TypeScript, and React to manage Homebrew packages and background services with system tray integration and resource monitoring.

### Technology Stack Decision

| Layer | Selected Tech | Reason |
|---|---|---|
| Runtime | Electron + TypeScript | Full native macOS support, safe IPC bridge, menu bar tray, dock integration |
| Package Manager | pnpm (v12.14.0) | Fast, efficient disk usage, already installed |
| Frontend | React 18 + Vite | Rapid reload, modular components, strict typing |
| Animation | Framer Motion | Smooth macOS micro-interactions, layout transitions |
| Styling | Modern CSS | Zero runtime overhead, clean native macOS appearance |
| System Metrics | pidusage, ps | Real-time CPU and memory metrics for active service PIDs |
| macOS Integration | Electron Notification, Tray | System notifications on spikes, menu bar control center |

---

## 2. High-Level Design (HLD)

```
+---------------------------------------------------------------------------------+
|                       Renderer Process (React UI)                               |
|                                                                                 |
|  +--------------------+  +----------------------+  +-------------------------+  |
|  | Search Bar View    |  | Installed & Services |  | Active Services Tab     |  |
|  | (Search / Install) |  | (List / Grid View)   |  | (Metrics & Logs)        |  |
|  +--------------------+  +----------------------+  +-------------------------+  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | macOS Menu Bar Tray Panel (Control Center Style for Running Services)     |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------|-----------------------------------------+
                                        | ContextBridge IPC (Safe & Typed)
+---------------------------------------v-----------------------------------------+
|                                Preload Script                                   |
|  window.brewApi = { search, install, list, start, stop, metrics, tray, ... }    |
+---------------------------------------|-----------------------------------------+
                                        |
+---------------------------------------v-----------------------------------------+
|                            Main Process (Node.js)                               |
|                                                                                 |
|  +---------------------+   +---------------------+   +-----------------------+  |
|  | BrewCommandExecutor |   | BrewServiceManager  |   | MetricsEngine         |  |
|  | (Safe CLI runner)   |   | (Start, Stop, State)|   | (CPU & RAM stats)     |  |
|  +---------------------+   +---------------------+   +-----------------------+  |
|             |                         |                         |               |
|  +---------------------+   +---------------------+   +-----------------------+  |
|  | integration/        |   | tray/               |   | Data Structures       |  |
|  | NotificationService |   | MenuBarManager      |   | (Trie, LRU,           |  |
|  | ThresholdWatcher    |   | TrayPopoverWindow   |   |  CircularBuffer)      |  |
|  +---------------------+   +---------------------+   +-----------------------+  |
+---------------------------------------------------------------------------------+
                                        |
                                        v
                       macOS System (Homebrew CLI, Notifications, Tray)
```

---

## 3. Low-Level Design (LLD)

### Design Patterns

1. **Command Pattern**: Encapsulates brew commands (`brew install`, `brew services start`, `brew services stop`, `brew upgrade`) with abort controller support.
2. **Observer Pattern**: `ServiceStatusWatcher` and `ThresholdWatcher` broadcast real-time status updates, metric events, and spike alerts.
3. **Adapter Pattern**: `BrewOutputParser` transforms raw JSON/stdout from Homebrew CLI into type-safe domain objects.
4. **Singleton Pattern**: `MetricsCollector` coordinates polling so that background PID queries do not cause CPU spikes.

### Core Class Contracts

```typescript
// Notification Threshold Interface
interface MetricThreshold {
  cpuPercentLimit: number;    // e.g. 80%
  memoryMbLimit: number;      // e.g. 1024 MB
  cooldownSeconds: number;    // Prevent alert flooding
}

// Notification Integration Contract
interface INotificationService {
  notifySpike(serviceName: string, metricType: "CPU" | "RAM", currentValue: number, limit: number): void;
  notifyServiceEvent(serviceName: string, event: "started" | "stopped" | "error"): void;
}

// Menu Bar Tray Contract
interface IMenuBarManager {
  createTray(): void;
  updateTrayIcon(runningCount: number): void;
  showPopover(bounds: Electron.Rectangle): void;
  hidePopover(): void;
  destroy(): void;
}

// Domain Model: Service
interface BrewService {
  name: string;
  status: "running" | "stopped" | "error" | "unknown";
  user?: string;
  file?: string;
  pid?: number;
  cpu?: number;
  memory?: number;
}
```

---

## 4. Resource Spike Notification Engine (`src/main/integration/`)

### Threshold Monitoring Flow
1. `MetricsCollector` samples active service PIDs every 3 seconds.
2. `ThresholdWatcher` evaluates usage against configured limits (default: CPU > 80%, RAM > 1024 MB).
3. When a spike is detected, `NotificationService` fires a macOS native notification.
4. Notification contains service name, metric details, and quick action buttons (Inspect / Stop).
5. Cooldown tracker prevents alert spamming (minimum 60 seconds between identical alerts).

---

## 5. macOS Menu Bar (Tray) Control Center

### Behavior and Life Cycle
1. **Window Close Behavior**: Closing the main dashboard window does not terminate the app. It hides to the macOS Status Bar.
2. **Status Bar Icon**:
   - Shows HomeBrew Manager icon with active services badge.
   - Click or hover opens the Menu Bar Popover.
3. **Popover UI Layout**:
   - **Single Active Service**: Compact card displaying service name, status indicator, CPU/RAM stats, and a Stop toggle.
   - **Multiple Active Services (e.g. 2 to 5+ services)**: macOS Control Center grid panel. Each service is rendered as an interactive tile with live metrics, quick toggle button, and link to open full dashboard.
4. **Context Menu**: Right-click tray menu provides quick access to "Open Dashboard", "Stop All Services", and "Quit App".

---

## 6. Data Structures and Algorithms (DSA)

1. **Trie (Prefix Tree) for Package Search**:
   - Enables instant `O(L)` prefix lookup as user types package names.
   - Fallback to fuzzy keyword matching with scoring.

2. **LRU Cache (Least Recently Used)**:
   - Stores parsed formula details and search responses.
   - Prevents redundant invocations of `brew info --json=v2`.

3. **Circular Buffer (Ring Buffer)**:
   - Fixed-size storage (`100` data points) for real-time CPU and Memory usage history.
   - Ensures `O(1)` append and read time without unbounded memory growth.

4. **Sliding Window Average (Spike Filtering)**:
   - Evaluates a 3-sample moving average before triggering spike notifications to filter out transient micro-spikes.

---

## 7. Folder Structure

```
HomeBrew Manager/
|-- .agents/
|   |-- hooks.json
|   |-- rules/
|   |   +-- communication-rules.md
|   |-- scripts/
|   |   +-- guardrails.py
|   +-- skills/
|       +-- security-audit/
|-- .github/
|   +-- copilot-instructions.md
|-- scripts/
|   |-- guard.py
|   +-- test_guardrails.py
|-- src/
|   |-- main/
|   |   |-- index.ts                 # Main Electron entry point
|   |   |-- integration/             # Notification and system integration
|   |   |   |-- NotificationService.ts # macOS Native notification dispatcher
|   |   |   +-- ThresholdWatcher.ts    # CPU, RAM, bandwidth spike evaluator
|   |   |-- tray/                    # macOS Menu Bar (Status Bar) module
|   |   |   |-- MenuBarManager.ts    # Tray lifecycle and icon management
|   |   |   +-- TrayWindow.ts        # Control Center popover window
|   |   |-- ipc/                     # Safe IPC handlers
|   |   |   |-- brewHandlers.ts
|   |   |   |-- metricsHandlers.ts
|   |   |   +-- trayHandlers.ts
|   |   |-- services/                # Core business logic
|   |   |   |-- BrewExecutor.ts      # Command pattern executor
|   |   |   |-- BrewServiceManager.ts# Service lifecycle manager
|   |   |   |-- MetricsCollector.ts  # PID stats poller
|   |   |   +-- SearchIndexer.ts     # Trie search engine
|   |   |-- utils/
|   |   |   |-- BrewOutputParser.ts  # CLI output adapter
|   |   |   |-- CircularBuffer.ts    # Ring buffer for metric charts
|   |   |   +-- LRUCache.ts          # Package metadata cache
|   |   +-- preload.ts               # ContextBridge typed API
|   |-- renderer/
|   |   |-- index.html               # Main window HTML
|   |   |-- tray.html                # Menu bar popover HTML
|   |   |-- src/
|   |   |   |-- App.tsx              # Main dashboard root
|   |   |   |-- TrayApp.tsx          # Control Center popover root
|   |   |   |-- index.css            # macOS styles, glassmorphism tokens
|   |   |   |-- components/
|   |   |   |   |-- Header.tsx       # Search bar and view toggle
|   |   |   |   |-- TabNavigation.tsx# Installed vs Active vs Updates
|   |   |   |   |-- ServiceCard.tsx  # Grid view card
|   |   |   |   |-- ServiceList.tsx  # Table list view
|   |   |   |   |-- MetricsModal.tsx # Real-time CPU, RAM graphs
|   |   |   |   |-- LogTerminal.tsx  # Live command output stream
|   |   |   |   |-- UpdateManager.tsx# Outdated upgrades view
|   |   |   |   +-- tray/
|   |   |   |       |-- SingleServiceCard.tsx  # Compact hover card
|   |   |   |       +-- ControlCenterPanel.tsx # Multi-service grid panel
|   |   |   |-- hooks/
|   |   |   |   |-- useBrewServices.ts
|   |   |   |   |-- usePackageSearch.ts
|   |   |   |   +-- useServiceMetrics.ts
|   |   |   +-- types/
|   |   |       +-- brew.d.ts        # Typed IPC definitions
|   |   +-- vite.config.ts           # Multi-page Vite build config
|-- electron-builder.json            # macOS DMG and app build config
|-- package.json                     # Scripts: dev, build, package
|-- tsconfig.json                    # Shared TypeScript configuration
|-- tsconfig.node.json               # Main process TypeScript configuration
|-- PLAN.md                          # Full Architecture Plan
+-- AGENTS.md                        # Agent guidelines
```

---

## 8. Key User Flows

### Flow 1: Search and Install
1. User enters package name in Search Bar.
2. Trie matches instant prefix, Homebrew API resolves details.
3. Card shows version, description, and status.
4. User clicks "Install". Safe terminal streams installation output.

### Flow 2: Background Life Cycle and Tray
1. User starts a service (e.g. `redis`) and closes or quits the main window.
2. The app minimizes to the macOS Menu Bar.
3. Clicking the menu bar icon reveals:
   - If 1 service: Compact status and metrics card.
   - If multiple services: macOS Control Center style panel with toggle switches for each service.

### Flow 3: Resource Spike Notifications
1. A service exceeds threshold limits (e.g. CPU > 80% or RAM > 1GB).
2. `ThresholdWatcher` validates spike using sliding window average.
3. macOS Notification Center displays alert with service name and metric stats.
4. User can inspect or stop the service directly.
