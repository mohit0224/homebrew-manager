use serde::{Deserialize, Serialize};
use sysinfo::{Pid, System};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemMetrics {
    pub cpu_usage_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessMetrics {
    pub pid: u32,
    pub cpu_percent: f32,
    pub memory_mb: u64,
}

#[derive(Clone)]
pub struct MetricsState {
    pub system: Arc<Mutex<System>>,
}

impl MetricsState {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self {
            system: Arc::new(Mutex::new(sys)),
        }
    }

    pub fn get_system_metrics(&self) -> SystemMetrics {
        let mut sys = self.system.lock().unwrap();
        sys.refresh_cpu_all();
        sys.refresh_memory();

        let cpu = sys.global_cpu_usage();
        let mem_used = sys.used_memory() / (1024 * 1024);
        let mem_total = sys.total_memory() / (1024 * 1024);

        SystemMetrics {
            cpu_usage_percent: cpu,
            memory_used_mb: mem_used,
            memory_total_mb: mem_total,
        }
    }

    pub fn get_process_metrics(&self, pid: u32) -> Option<ProcessMetrics> {
        let mut sys = self.system.lock().unwrap();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);

        if let Some(process) = sys.process(Pid::from_u32(pid)) {
            let cpu = process.cpu_usage();
            let memory = process.memory() / (1024 * 1024);
            Some(ProcessMetrics {
                pid,
                cpu_percent: cpu,
                memory_mb: memory,
            })
        } else {
            None
        }
    }
}
