---
name: homebrew-desktop-performance
description: Audit and optimize a macOS Homebrew GUI manager built with Tauri, Rust, React, and optionally Python. Use when investigating UI freezes, beachball/loading cursor, slow installs, service operations, process management, IPC, rendering, or system resource usage.
---

# Homebrew Desktop Performance Engineer

## Goal

Improve UI responsiveness, process lifecycle management, reliability,
and resource efficiency without breaking existing Homebrew operations.

## Phase 1: Audit before editing

- Inspect the complete project structure and dependency versions.
- Trace install, uninstall, update, start, stop, and restart flows.
- Trace each action from React through Tauri IPC to native process execution.
- Identify blocking calls, synchronous I/O, excessive polling, repeated
  Homebrew invocations, and unnecessary React re-renders.
- Inspect stdout/stderr handling and large-output buffering.
- Determine whether lag originates in the UI, application process,
  Homebrew, or another subprocess.
- Establish reproducible baseline measurements.

## Phase 2: Process architecture

- Keep long-running Homebrew commands off the UI-blocking execution path.
- Use appropriate async tasks or dedicated blocking workers for
  process execution.
- Spawn long-running operations when appropriate instead of waiting
  for complete output before returning control to the UI.
- Stream output incrementally and bound log memory usage.
- Track process IDs, exit codes, signals, errors, and cancellation.
- Prevent duplicate operations on the same service.
- Avoid unsafe shell-string interpolation; validate executable paths
  and arguments.
- Preserve correct Homebrew environment and PATH resolution.

## Phase 3: React performance

- Keep loading state scoped to the affected operation.
- Avoid unnecessary component re-renders and repeated IPC calls.
- Avoid excessive status polling; prefer events where appropriate.
- Virtualize large log lists if needed.
- Keep animations and user interaction responsive during operations.

## Phase 4: Correctness and safety

- Preserve all existing product features and behavior.
- Never terminate unrelated user processes.
- Do not run privileged commands or alter permissions unnecessarily.
- Handle failures, timeouts, partial output, and application shutdown.
- Do not run destructive Homebrew operations during testing.

## Phase 5: Verification

- Add tests for process execution and error handling.
- Measure UI responsiveness during long-running commands.
- Compare CPU, memory, command duration, and UI latency before and after.
- Run existing tests, lint, type checks, and builds.
- Report modified files, risks, measured improvements, and remaining issues.

## Rules

- Audit first; do not rewrite the application blindly.
- Present findings and a prioritized remediation plan before large changes.
- Make small, reviewable changes and verify each one.
- Never claim performance gains without measurements.
