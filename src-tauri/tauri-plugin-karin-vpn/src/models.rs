use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareResult {
    pub prepared: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRequest {
    pub config_json: String,
    #[serde(default = "default_mtu")]
    pub mtu: u16,
    #[serde(default = "default_app_routing_mode")]
    pub app_routing_mode: String,
    #[serde(default)]
    pub app_packages: Vec<String>,
}

fn default_mtu() -> u16 { 1500 }
fn default_app_routing_mode() -> String { "all".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub label: String,
    pub package_name: String,
    #[serde(default)]
    pub system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAppsResult {
    pub apps: Vec<InstalledApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnStatus {
    pub running: bool,
    #[serde(default)]
    pub starting: bool,
    #[serde(default)]
    pub core_running: bool,
    #[serde(default)]
    pub reconnecting: bool,
    #[serde(default)]
    pub always_on: bool,
    #[serde(default)]
    pub lockdown: bool,
    #[serde(default = "default_app_routing_mode")]
    pub app_routing_mode: String,
    #[serde(default)]
    pub app_package_count: u32,
    pub tun_fd: Option<i32>,
    pub core_version: Option<String>,
    pub last_error: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsResult {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearLogsResult {
    pub cleared: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDocumentRequest {
    pub filename: String,
    pub content: String,
    #[serde(default = "default_document_mime")]
    pub mime_type: String,
}

fn default_document_mime() -> String { "application/json".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDocumentResult {
    pub saved: bool,
    pub uri: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSettingsResult {
    pub opened: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchTextRequest {
    pub url: String,
    #[serde(default = "default_fetch_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default = "default_fetch_max_bytes")]
    pub max_bytes: u64,
}

fn default_fetch_timeout_ms() -> u64 { 20_000 }
fn default_fetch_max_bytes() -> u64 { 8 * 1024 * 1024 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchTextResult {
    pub status: u16,
    pub final_url: String,
    pub content: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfoResult {
    pub manufacturer: String,
    pub brand: String,
    pub model: String,
    pub device: String,
    pub android_release: String,
    pub sdk_int: u32,
}
