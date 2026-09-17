use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::tree::FsNode;

pub struct ScanControl {
    pub cancel: AtomicBool,
    pub generation: u64,
}

#[derive(Clone)]
pub struct AppState {
    pub tree: Arc<Mutex<Option<FsNode>>>,
    pub root: Arc<Mutex<Option<PathBuf>>>,
    control: Arc<Mutex<Option<Arc<ScanControl>>>>,
    generation: Arc<AtomicU64>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            tree: Arc::new(Mutex::new(None)),
            root: Arc::new(Mutex::new(None)),
            control: Arc::new(Mutex::new(None)),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn begin_scan(&self) -> Arc<ScanControl> {
        if let Some(current) = self.control.lock().expect("scan control").as_ref() {
            current.cancel.store(true, Ordering::Relaxed);
        }
        let control = Arc::new(ScanControl {
            cancel: AtomicBool::new(false),
            generation: self.generation.fetch_add(1, Ordering::Relaxed) + 1,
        });
        *self.control.lock().expect("scan control") = Some(control.clone());
        control
    }

    pub fn cancel_scan(&self) {
        if let Some(current) = self.control.lock().expect("scan control").as_ref() {
            current.cancel.store(true, Ordering::Relaxed);
        }
    }

    pub fn is_current(&self, control: &ScanControl) -> bool {
        self.generation.load(Ordering::Relaxed) == control.generation
            && !control.cancel.load(Ordering::Relaxed)
    }
}
