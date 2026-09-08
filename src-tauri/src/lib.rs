//! OS credential storage for JARVEX AI.
//!
//! Exposes a minimal credential-store surface backed by the Windows OS
//! credential store (Windows Credential Manager) via the maintained `keyring`
//! crate. The frontend never sees storage internals — only get/set/delete.
//!
//! Security notes:
//! - Secrets are never logged or included in error messages.
//! - `service` is locked to the JARVEX application identifier and `account`
//!   must be a provider id (`[a-z][a-z0-9-]{0,63}`), so the app cannot be used
//!   to read unrelated OS credentials.

const SERVICE: &str = "in.jarvex.ai";
const MAX_SECRET_LEN: usize = 4096;

fn is_valid_account(account: &str) -> bool {
  let mut chars = account.chars();
  match chars.next() {
    Some(first) if first.is_ascii_lowercase() => {}
    _ => return false,
  }
  account.len() <= 64
    && account
      .chars()
      .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn entry(account: &str) -> Result<keyring::Entry, String> {
  if !is_valid_account(account) {
    return Err("Invalid credential account".to_string());
  }
  keyring::Entry::new(SERVICE, account)
    .map_err(|e| format!("OS credential store unavailable: {e}"))
}

#[tauri::command]
fn credential_set(account: String, secret: String) -> Result<(), String> {
  if secret.is_empty() || secret.len() > MAX_SECRET_LEN {
    return Err("Invalid secret length".to_string());
  }
  entry(&account)?
    .set_password(&secret)
    .map_err(|e| format!("Failed to store credential: {e}"))
}

#[tauri::command]
fn credential_get(account: String) -> Result<Option<String>, String> {
  match entry(&account)?.get_password() {
    Ok(secret) => Ok(Some(secret)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(format!("Failed to read credential: {e}")),
  }
}

#[tauri::command]
fn credential_delete(account: String) -> Result<(), String> {
  match entry(&account)?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(format!("Failed to remove credential: {e}")),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Self-test proving the Windows Credential Manager path works on this
  /// machine. Cleans up after itself; the test credential is removed.
  #[test]
  fn os_credential_store_roundtrip() {
    let account = "selftest";
    credential_delete(account.to_string()).expect("cleanup before test");

    credential_set(
      account.to_string(),
      "jarvex-selftest-secret".to_string(),
    )
    .expect("credential_set should succeed");

    let read = credential_get(account.to_string())
      .expect("credential_get should succeed");
    assert_eq!(read.as_deref(), Some("jarvex-selftest-secret"));

    credential_delete(account.to_string()).expect("credential_delete should succeed");

    let gone =
      credential_get(account.to_string()).expect("credential_get after delete");
    assert_eq!(gone, None);
  }

  #[test]
  fn rejects_invalid_accounts() {
    assert!(!is_valid_account(""));
    assert!(!is_valid_account("../evil"));
    assert!(!is_valid_account("Upper"));
    assert!(!is_valid_account("has space"));
    assert!(is_valid_account("gemini"));
    assert!(is_valid_account("qwen-coder-3b"));
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      credential_get,
      credential_set,
      credential_delete
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
