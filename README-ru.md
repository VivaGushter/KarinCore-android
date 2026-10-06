<div align="center">
  <img src="public/karincore-icon-main.png" alt="KarinCore" width="160"/>
  <h1>KarinCore Android</h1>
  <p>Android-порт KarinCore на Tauri 2, Rust, Android VpnService и Xray-core.</p>
  <p><strong>Текущая версия: 0.1.0-alpha.1</strong></p>
  <p><a href="README.md">English</a></p>
</div>

## Состояние проекта

Это экспериментальный Android-порт [detestern/KarinCore](https://github.com/detestern/KarinCore). За основу взят KarinCore 1.3.7, commit `b7fea2e2ff5e1492fd863381985fdebb4da7a57e`.

В Android-порте сохранены интерфейс на TypeScript/Vite и общая Rust-логика KarinCore: парсинг ссылок, подписки, маршрутизация, DNS и профили. Linux-часть с `sudo`, systemd, `route.sh`, iptables и системным Xray на Android заменена нативным `VpnService`.

Исходники версии `0.1.0-alpha.1` подготовлены под Android, но **полная сборка APK на настоящем Android SDK/NDK и проверка на устройстве ещё не выполнены**. Это следующий контрольный этап.

## Что уже есть в 0.1.0-alpha.1

- мобильная точка входа Tauri 2;
- Android `VpnService`;
- foreground service;
- настоящий TUN с IPv4 и IPv6;
- Xray через закреплённый `AndroidLibXrayLite v26.9.30`;
- передача TUN FD напрямую в `CoreController.startLoop(...)`;
- существующие парсеры KarinCore для VLESS/Reality, VMess, Trojan и Shadowsocks;
- маршрутизация Direct / Proxy / Block;
- DNS-пакеты из TUN направляются в Xray `dns-out`;
- собственный пакет KarinCore исключён из VPN, чтобы Xray не завернулся сам в себя;
- команды prepare/start/stop/status;
- закрытие Activity/WebView не отключает foreground VPN;
- для Android `reqwest` использует Rustls.

Пока не реализованы: цепочки OpenVPN/WireGuard, выбор приложений для VPN, полноценные Android-логи, обработка смены Wi-Fi/LTE без заметного разрыва, мобильная полировка интерфейса и экспорт через Android document picker.

## Первый запуск сборки

Нужны Rust, Node.js, Android Studio, Android SDK, Platform Tools, Build Tools, NDK и Command-line Tools.

Для сборки добавляются Android targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Последовательность первого запуска:

```bash
git clone https://github.com/VivaGushter/KarinCore-android.git
cd KarinCore-android

npm install
npm run android:core
npm run android:init
npm run android:dev
```

`android:core` скачивает закреплённый `libv2ray.aar` и проверяет SHA-256. Сам AAR в Git не хранится.

После первого успешного `tauri android init` можно закоммитить воспроизводимые файлы из `src-tauri/gen/android`. Машинный `local.properties` уже исключён через `.gitignore`.

## Версии

Android-порт имеет свою ветку SemVer и не обязан повторять номер Linux-версии.

Перед релизным коммитом:

```bash
npm run version:check
```

Скрипт проверяет совпадение версии в `VERSION`, `package.json`, `src-tauri/Cargo.toml` и `src-tauri/tauri.conf.json`. Android `versionCode` должен только увеличиваться.

История изменений: [CHANGELOG.md](CHANGELOG.md).

## Лицензия и исходный проект

Исходный KarinCore распространяется по MIT. Оригинальное уведомление сохранено в [LICENSE](LICENSE).

Для Android используется `2dust/AndroidLibXrayLite`. Подробности: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
