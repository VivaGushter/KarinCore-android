# KarinCore Android: development roadmap

Current baseline: `0.1.0-alpha.20`.

Основная стратегия: сначала доказать стабильность существующего Android core на реальном устройстве, затем расширять transports. Добавление функций без runtime validation на этом этапе имеет меньшую ценность.

## P0. Real-device stabilization

### P0.1 Core proxy matrix

Проверить отдельно:

- VLESS
- VLESS Reality
- VMess
- Trojan
- Shadowsocks
- WireGuard

Для каждого:

1. connect
2. HTTPS browsing
3. DNS
4. self-test
5. disconnect
6. reconnect
7. close/reopen Activity while VPN remains active

### P0.2 Network families

Проверить:

- IPv4
- IPv6 при наличии
- отсутствие IPv6 leak
- mobile network only
- Wi-Fi only

Self-test уже умеет отдельно показывать IPv4 и IPv6.

### P0.3 Handover

Проверить:

- Wi-Fi -> LTE/5G
- LTE/5G -> Wi-Fi
- temporary no-network gap
- reconnect after airplane mode
- repeated handovers

Критерий: Android TUN не пересоздаётся без необходимости, Xray восстанавливает traffic.

### P0.4 Per-app

Режимы:

- all
- only selected
- bypass selected

Проверить:

- user app
- system/launcher app
- package removed after selection
- app list after Android restart

### P0.5 Always-on / lockdown

Проверить:

- enable Always-on
- enable Block connections without VPN
- process kill
- reboot
- profile restore
- network unavailable at boot
- network becomes available later
- manual disconnect UX

Обязательно тестировать на нескольких OEM, если доступны:

- AOSP/Pixel-like
- Xiaomi/HyperOS
- Samsung/One UI

### P0.6 Subscriptions

Проверить:

- initial add
- native HTTP timeout
- TLS failure
- redirect
- gzip
- Base64
- JSON
- imported routing/DNS
- WireGuard profile in subscription
- refresh
- removed profile
- pinned profile
- active profile removed during refresh

## P1. Automated tests before major refactor

### Rust unit tests

Добавить tests для:

- VLESS/VMess/Trojan/SS parsing
- WireGuard payload decoding
- WireGuard config sanitization
- WireGuard validation
- subscription plain/Base64/JSON parsing
- routing conversion
- DNS conversion
- Android Xray rule generation
- secret redaction

### Frontend tests

Добавить минимальный test runner и tests:

- SemVer prerelease comparison
- subscription refresh identity preservation
- local storage migration
- stale selected profile handling
- app routing state

### CI

Оставить текущие checks и добавить test job без замедления release build сверх разумного.

## P2. Codebase modularization

После появления tests постепенно разделить:

- Rust `lib.rs`
- frontend `main.ts`

Каждый refactor commit должен быть behavior-preserving.

Не смешивать structural refactor и новый transport в одном commit.

## P3. OpenVPN on Android

OpenVPN является следующим крупным отсутствующим transport.

До реализации требуется architecture/design document.

Обязательные ограничения:

1. Нельзя поднимать второй Android `VpnService`.
2. Нельзя создавать конкурирующий system TUN.
3. Нельзя просто перенести Linux `openvpn` binary + route scripts.
4. Нужно проверить license выбранного Android/OpenVPN core.
5. Нужно определить, как transport будет отдавать traffic Xray или работать под существующим TUN.
6. Перед embedding сторонней библиотеки зафиксировать license implications в `THIRD_PARTY_NOTICES.md`.

Рекомендуемая последовательность:

- research available OpenVPN cores/libraries
- license matrix
- architecture proposal
- small proof of concept
- only then production integration

## P4. Release engineering

Перед beta:

- production signing strategy
- GitHub secrets for signing
- release APK
- optional AAB
- release build separate from debug APK
- ProGuard/R8 evaluation
- ABI strategy
- crash diagnostics
- reproducibility notes
- privacy policy if required by stores
- release notes automation review

Текущий GitHub prerelease APK debug-signed и предназначен для testing.

## P5. Multi-ABI

После arm64 stabilization:

- armv7 if still desired
- x86_64 for emulator/testing

Не расширять ABI до стабилизации arm64, если это только увеличивает CI cost.

## P6. UX polish

После runtime stabilization:

- profile state edge cases
- long names
- orientation
- small displays
- tablets
- Android back behavior
- dialogs/keyboard
- notification wording
- error localization
- accessibility
- dark/light consistency

## P7. Beta exit criteria

Переход к `0.1.0-beta.1` возможен, когда:

- VLESS Reality stable on real device
- VMess/Trojan/SS core paths checked
- WireGuard checked on real device
- subscriptions + refresh checked
- per-app checked
- Wi-Fi/cellular handover checked
- Always-on reboot checked
- no known DNS/IPv4 critical leak
- diagnostics produce useful report without secrets
- CI tests exist for core parsers/config generation
- no P0/P1 crash or traffic-blocking issue

OpenVPN может быть либо beta requirement, либо перенесён после beta отдельным решением владельца проекта.

## P8. Stable release criteria

До stable:

- signed release pipeline
- documented upgrade path
- store distribution decision
- privacy documentation
- clean changelog
- supported Android versions documented
- known limitations documented
- verified update channel
- release APK/AAB reproducible enough for project needs

## Рекомендуемая следующая итерация

Если новых device logs нет, следующей задачей рекомендуется не новый feature, а test foundation:

1. Rust unit tests для WireGuard/subscription/routing.
2. Minimal frontend tests для version/refresh logic.
3. Затем real-device bug fixes.
4. После этого OpenVPN design research.

Если пользователь предоставляет конкретный runtime bug, он получает приоритет над roadmap.
