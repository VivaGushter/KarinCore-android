const COMMANDS: &[&str] = &["prepare", "start", "stop", "status"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let mobile = target_os == "android" || target_os == "ios";
    alias("mobile", mobile);
    alias("desktop", !mobile);
}

fn alias(alias: &str, enabled: bool) {
    println!("cargo:rustc-check-cfg=cfg({alias})");
    if enabled {
        println!("cargo:rustc-cfg={alias}");
    }
}
