mod error;
mod models;

pub use error::{Error, Result};
pub use models::{PrepareResult, StartRequest, VpnStatus};

use tauri::{Manager, Runtime, plugin::TauriPlugin};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.vivagushter.karincore.vpn";

pub struct KarinVpn<R: Runtime> {
    #[cfg(target_os = "android")]
    mobile_plugin_handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _marker: std::marker::PhantomData<fn() -> R>,
}

impl<R: Runtime> KarinVpn<R> {
    #[cfg(target_os = "android")]
    pub fn prepare(&self) -> Result<PrepareResult> {
        self.mobile_plugin_handle
            .run_mobile_plugin("prepare", ())
            .map_err(Error::from)
    }

    #[cfg(not(target_os = "android"))]
    pub fn prepare(&self) -> Result<PrepareResult> {
        Err(Error::UnsupportedPlatform)
    }

    #[cfg(target_os = "android")]
    pub fn start(&self, request: StartRequest) -> Result<VpnStatus> {
        self.mobile_plugin_handle
            .run_mobile_plugin("start", request)
            .map_err(Error::from)
    }

    #[cfg(not(target_os = "android"))]
    pub fn start(&self, _request: StartRequest) -> Result<VpnStatus> {
        Err(Error::UnsupportedPlatform)
    }

    #[cfg(target_os = "android")]
    pub fn stop(&self) -> Result<VpnStatus> {
        self.mobile_plugin_handle
            .run_mobile_plugin("stop", ())
            .map_err(Error::from)
    }

    #[cfg(not(target_os = "android"))]
    pub fn stop(&self) -> Result<VpnStatus> {
        Err(Error::UnsupportedPlatform)
    }

    #[cfg(target_os = "android")]
    pub fn status(&self) -> Result<VpnStatus> {
        self.mobile_plugin_handle
            .run_mobile_plugin("status", ())
            .map_err(Error::from)
    }

    #[cfg(not(target_os = "android"))]
    pub fn status(&self) -> Result<VpnStatus> {
        Err(Error::UnsupportedPlatform)
    }
}

pub trait KarinVpnExt<R: Runtime> {
    fn karin_vpn(&self) -> &KarinVpn<R>;
}

impl<R: Runtime, T: Manager<R>> KarinVpnExt<R> for T {
    fn karin_vpn(&self) -> &KarinVpn<R> {
        self.state::<KarinVpn<R>>().inner()
    }
}

#[tauri::command]
async fn prepare<R: Runtime>(app: tauri::AppHandle<R>) -> Result<PrepareResult> {
    app.karin_vpn().prepare()
}

#[tauri::command]
async fn start<R: Runtime>(app: tauri::AppHandle<R>, request: StartRequest) -> Result<VpnStatus> {
    app.karin_vpn().start(request)
}

#[tauri::command]
async fn stop<R: Runtime>(app: tauri::AppHandle<R>) -> Result<VpnStatus> {
    app.karin_vpn().stop()
}

#[tauri::command]
async fn status<R: Runtime>(app: tauri::AppHandle<R>) -> Result<VpnStatus> {
    app.karin_vpn().status()
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("karin-vpn")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "KarinVpnPlugin")?;

            app.manage(KarinVpn {
                #[cfg(target_os = "android")]
                mobile_plugin_handle: handle,
                #[cfg(not(target_os = "android"))]
                _marker: std::marker::PhantomData,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![prepare, start, stop, status])
        .build()
}
