<div align="center">
  <img src="public/karincore-icon-main.png" alt="KarinCore" width="160"/>
  <h1>KarinCore Android</h1>
  <p>Android-порт KarinCore на Tauri 2, Rust, Android VpnService и Xray-core.</p>
  <p><strong>Текущая версия: 0.1.0-alpha.19</strong></p>
  <p><a href="README.md">English</a></p>
</div>

## Состояние проекта

Это экспериментальный Android-порт [detestern/KarinCore](https://github.com/detestern/KarinCore). За основу взят KarinCore 1.3.7, commit `b7fea2e2ff5e1492fd863381985fdebb4da7a57e`.

В Android-порте сохранены интерфейс на TypeScript/Vite и общая Rust-логика KarinCore: парсинг ссылок, подписки, маршрутизация, DNS и профили. Linux-часть с `sudo`, systemd, `route.sh`, iptables и системным Xray на Android заменена нативным `VpnService`.

Версия `0.1.0-alpha.19` успешно проходит полную CI-сборку arm64 debug APK в GitHub Actions. Следующий контрольный этап: запуск и проверка на реальном Android-устройстве.

## Реализовано к 0.1.0-alpha.19

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
- Android P+ отслеживает смену underlying network; при переходе Wi-Fi/сотовая сеть Xray перезапускается без пересоздания TUN;
- выбор приложений для VPN с режимами «Все приложения», «Только выбранные» и «Выбранные мимо VPN»;
- список запускаемых Android-приложений получается нативно, поддерживает поиск и сохраняет выбранные пакеты;
- нативный буфер событий VPN/Xray подключён к существующей вкладке Logs: запуск, ошибки, режим маршрутизации приложений, смена сети и status-события Xray;
- экспорт профилей через системный Android document picker;
- отдельная мобильная раскладка без desktop titlebar, с safe-area отступами и вертикальной маршрутизацией на узких экранах;
- версия и update checker получают номер релиза из Rust-пакета вместо хардкода во frontend;
- package visibility для launcher-приложений объявлена явно, чтобы список per-app routing не обрезался на Android 11+;
- восстановление сети обрабатывает как make-before-break, так и break-before-make сценарии;
- после пересоздания Activity/WebView интерфейс восстанавливает состояние подключения из нативного VPN-сервиса; устаревшее frontend-состояние удаляется, если сервис уже не работает;
- поддерживается системный режим Android «Постоянная VPN»: последний успешно запущенный нативный конфиг сохраняется для системного рестарта и восстановления после перезагрузки;
- из настроек KarinCore открывается системный экран VPN для включения «Постоянной VPN» и «Блокировать подключения без VPN»;
- интерфейс показывает состояние Always-on/lockdown и не изображает обычное отключение доступным, когда системный Always-on активен;
- на Android подписки загружаются нативно через Kotlin HTTP вместо Rust reqwest, с таймаутами подключения/чтения, ограничением редиректов и отдельными ошибками TLS/сети;
- во frontend добавлен независимый watchdog на 25 секунд, поэтому интерфейс больше не может бесконечно оставаться в Loading даже при зависшем native bridge;
- для Android `reqwest` использует Rustls;
- во вкладке Logs добавлена самопроверка VPN: состояние нативного сервиса, Xray, TUN, принудительный proxy-path с DNS/HTTPS и внешний IP через активный прокси.

Пока не реализованы: OpenVPN chaining и дополнительная полировка после тестов на реальном устройстве. Always-on/lockdown, IPv6 и OEM-особенности требуют проверки на реальном устройстве.

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

После первого успешного `tauri android init` воспроизводимые файлы из `src-tauri/gen/android` могут быть добавлены в репозиторий. Машинный `local.properties` исключён через `.gitignore`.

## Версии

Android-порт имеет свою ветку SemVer и не обязан повторять номер Linux-версии.

Проверка перед релизным коммитом:

```bash
npm run version:check
```

Скрипт проверяет совпадение версии в `VERSION`, `package.json`, `src-tauri/Cargo.toml` и `src-tauri/tauri.conf.json`. Android `versionCode` должен только увеличиваться.

История изменений: [CHANGELOG.md](CHANGELOG.md).

## Лицензия и исходный проект

Исходный KarinCore распространяется по MIT. Оригинальное уведомление сохранено в [LICENSE](LICENSE).

Для Android используется `2dust/AndroidLibXrayLite`. Подробности: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
