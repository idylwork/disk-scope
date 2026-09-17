use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskAccessStatus {
    pub needed: bool,
    pub granted: bool,
}

pub fn status() -> DiskAccessStatus {
    #[cfg(target_os = "macos")]
    {
        DiskAccessStatus {
            needed: true,
            granted: has_full_disk_access(),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        DiskAccessStatus {
            needed: false,
            granted: true,
        }
    }
}

pub fn open_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        open_macos_full_disk_access_settings()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn has_full_disk_access() -> bool {
    // Desktop / Documents を触るとフォルダ単位の確認が出る。
    // TCC.db はフルディスクアクセスがあるときだけ読める。
    let Some(home) = std::env::var_os("HOME") else {
        return false;
    };
    let tcc_db = std::path::PathBuf::from(home)
        .join("Library/Application Support/com.apple.TCC/TCC.db");
    std::fs::File::open(tcc_db).is_ok()
}

#[cfg(target_os = "macos")]
fn open_macos_full_disk_access_settings() -> Result<(), String> {
    const URLS: [&str; 2] = [
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    ];
    let mut last_error = "システム設定を開けませんでした".to_string();
    for url in URLS {
        match std::process::Command::new("open").arg(url).status() {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => last_error = format!("システム設定の起動に失敗しました ({status})"),
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(last_error)
}
