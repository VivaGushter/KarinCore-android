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
    pub tun_fd: Option<i32>,
    pub core_version: Option<String>,
    pub last_error: Option<String>,
}
