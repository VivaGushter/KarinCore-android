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
}

fn default_mtu() -> u16 { 1500 }

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
