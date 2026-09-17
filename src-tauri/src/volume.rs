use std::path::Path;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub mount_path: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

/// パスが属するボリュームの容量と空きを返す
pub fn query(path: &Path) -> Result<VolumeInfo, String> {
    #[cfg(unix)]
    {
        query_unix(path)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Err("この環境ではボリューム情報を取得できません".into())
    }
}

#[cfg(unix)]
fn query_unix(path: &Path) -> Result<VolumeInfo, String> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let c_path = CString::new(path.as_os_str().as_bytes())
        .map_err(|_| "パスに使えない文字が含まれています".to_string())?;

    #[cfg(target_os = "macos")]
    {
        let mut buf = unsafe { std::mem::zeroed::<libc::statfs>() };
        let result = unsafe { libc::statfs(c_path.as_ptr(), &mut buf) };
        if result != 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        let block = u64::from(buf.f_bsize);
        let mount_path = c_chars_to_string(&buf.f_mntonname);
        Ok(VolumeInfo {
            name: volume_name(&mount_path),
            mount_path,
            total_bytes: (buf.f_blocks as u64).saturating_mul(block),
            available_bytes: (buf.f_bavail as u64).saturating_mul(block),
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let mut buf = unsafe { std::mem::zeroed::<libc::statvfs>() };
        let result = unsafe { libc::statvfs(c_path.as_ptr(), &mut buf) };
        if result != 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        let fragment = if buf.f_frsize > 0 {
            buf.f_frsize as u64
        } else {
            buf.f_bsize as u64
        };
        Ok(VolumeInfo {
            name: "ボリューム".into(),
            mount_path: path.to_string_lossy().into_owned(),
            total_bytes: (buf.f_blocks as u64).saturating_mul(fragment),
            available_bytes: (buf.f_bavail as u64).saturating_mul(fragment),
        })
    }
}

#[cfg(target_os = "macos")]
fn c_chars_to_string(bytes: &[libc::c_char]) -> String {
    let raw = unsafe { std::ffi::CStr::from_ptr(bytes.as_ptr()) };
    raw.to_string_lossy().into_owned()
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn volume_name(mount_path: &str) -> String {
    if mount_path == "/" {
        return "/".to_string();
    }
    mount_path
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .unwrap_or(mount_path)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::{query, volume_name};
    use std::path::Path;

    #[test]
    fn volume_name_uses_last_segment() {
        assert_eq!(volume_name("/"), "/");
        assert_eq!(volume_name("/System/Volumes/Data"), "Data");
        assert_eq!(volume_name("/Volumes/Backup/"), "Backup");
    }

    #[test]
    fn query_returns_capacity_for_existing_path() {
        let info = query(Path::new(".")).expect("volume");
        assert!(info.total_bytes > 0);
        assert!(info.available_bytes <= info.total_bytes);
        assert!(!info.mount_path.is_empty());
    }
}
