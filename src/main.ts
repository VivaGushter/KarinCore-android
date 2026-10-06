import { invoke } from "@tauri-apps/api/core";
import { translations } from "./i18n";

// **********************************
// TYPES & INTERFACES
// **********************************
interface ProxyGroup { id: string; name: string; pinned: boolean; isOpen: boolean; }
interface ProxyLink { id: string; url: string; pinned: boolean; groupId: string | null; }
interface DnsConfig { type: string, url: string, ip: string }
interface RouteProfile { id: string, name: string, defaultOutbound: string, rules: any, domDns?: DnsConfig, remDns?: DnsConfig, zonePriority?: ZoneKey[] }
interface RoutingRule { type: string; value: string; }
type ZoneKey = 'direct' | 'proxy' | 'block';
type AppRoutingMode = 'all' | 'allowlist' | 'denylist';
interface InstalledApp { label: string; packageName: string; system: boolean; }
interface RuntimeInfo { platform: 'android' | 'desktop'; version: string; updateRepo: string; }
const PROJECT_REPO = 'VivaGushter/KarinCore-android';
const UPSTREAM_REPO = 'detestern/KarinCore';
interface VpnRuntimeStatus {
    running: boolean;
    starting: boolean;
    coreRunning: boolean;
    reconnecting: boolean;
    alwaysOn: boolean;
    lockdown: boolean;
    appRoutingMode?: string;
    appPackageCount?: number;
    tunFd?: number | null;
    coreVersion?: string | null;
    lastError?: string | null;
}
interface SubscriptionResult { links: string[]; importedRouting?: Record<ZoneKey, RoutingRule[]>; importedDns?: { domestic?: DnsConfig; remote?: DnsConfig }; }

// **********************************
// STATE MANAGEMENT & LOCAL STORAGE
// **********************************
function safeParse(key: string, fallback: any): any {
    try {
        const val = localStorage.getItem(key);
        if (!val) return fallback;
        const parsed = JSON.parse(val);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

let runtimeInfo: RuntimeInfo = { platform: 'desktop', version: '0.0.0', updateRepo: PROJECT_REPO };
let nativeVpnRunning = false;
let nativeVpnStarting = false;
let nativeVpnCoreRunning = false;
let nativeVpnReconnecting = false;
let nativeVpnAlwaysOn = false;
let nativeVpnLockdown = false;
let nativeStatusInterval: number | null = null;
let nativeStatusPollInFlight = false;
let lastNativeStatusSignature = '';
let currentTheme = localStorage.getItem('karin_theme') || 'dark';
let currentLang = localStorage.getItem('karin_lang') || 'en';
let activeLink: string | null = sessionStorage.getItem('karin_active_link') || null;
let selectedProfileUrl: string | null = localStorage.getItem('karin_selected_profile') || null;
let allAvailableTags: string[] = [];
let currentZone: ZoneKey = 'proxy';
let defaultOutbound: ZoneKey = 'proxy';
let allowServerProxy = safeParse('karin_allow_server_proxy', false);
let allowProxyLan = safeParse('karin_allow_proxy_lan', false);
let appRoutingMode: AppRoutingMode = safeParse('karin_app_routing_mode', 'all');
if (!['all', 'allowlist', 'denylist'].includes(appRoutingMode)) appRoutingMode = 'all';
const savedAppPackages = safeParse('karin_app_packages', []);
let selectedAppPackages = new Set<string>(
    Array.isArray(savedAppPackages) ? savedAppPackages.filter((pkg: unknown) => typeof pkg === 'string') : []
);
let installedApps: InstalledApp[] = [];
let isEditMode = false;
let selectedLinks = new Set<string>();
let selectedGroups = new Set<string>();
let logInterval: number | null = null; 

let zonePriority: ZoneKey[] = safeParse('karin_zone_priority', ['proxy', 'direct', 'block']);

const savedOutbound = localStorage.getItem('karin_default_outbound');
if (savedOutbound === 'direct' || savedOutbound === 'proxy' || savedOutbound === 'block') {
    defaultOutbound = savedOutbound;
}

let appGroups: ProxyGroup[] = safeParse('karin_groups', []);
if (!Array.isArray(appGroups)) appGroups = [];

let rawLinks = safeParse('karin_links', []);
if (!Array.isArray(rawLinks)) rawLinks = [];
let appLinks: ProxyLink[] = rawLinks.map((l: any) => {
    if (typeof l === 'string') return { id: 'link_' + Date.now() + Math.random(), url: l, pinned: false, groupId: null };
    if (!l.id) return { id: 'link_' + Date.now() + Math.random(), url: l.url, pinned: l.pinned || false, groupId: null };
    return l;
});

let routingState: Record<ZoneKey, RoutingRule[]> = safeParse('karin_routing', { direct: [], proxy: [], block: [] });
if (!routingState.direct) routingState.direct = [];
if (!routingState.proxy) routingState.proxy = [];
if (!routingState.block) routingState.block = [];

let routeProfiles: RouteProfile[] = safeParse('karin_route_profiles', []);
if (!Array.isArray(routeProfiles)) routeProfiles = [];
routeProfiles = routeProfiles.map(p => {
    if (!p.domDns) p.domDns = { type: "doh", url: "https://dns.yandex.ru/dns-query", ip: "77.88.8.8" };
    if (!p.remDns) p.remDns = { type: "doh", url: "https://1.1.1.1/dns-query", ip: "1.1.1.1" };
    if (!p.rules) p.rules = { direct: [], proxy: [], block: [] };
    if (!p.zonePriority) p.zonePriority = ['proxy', 'direct', 'block'];
    return p;
});

function saveData() {
    localStorage.setItem('karin_groups', JSON.stringify(appGroups));
    localStorage.setItem('karin_links', JSON.stringify(appLinks));
}

function cleanEmptyGroups() { 
    appGroups = appGroups.filter(g => appLinks.some(l => l.groupId === g.id)); 
}

// **********************************
// DOM ELEMENTS
// **********************************
const logOutput = document.getElementById('log-output') as HTMLPreElement | null;
const toggleLogs = document.getElementById('toggle-logs') as HTMLInputElement | null;
const androidLogActions = document.getElementById('android-log-actions') as HTMLDivElement | null;
const btnVpnSelfTest = document.getElementById('btn-vpn-self-test') as HTMLButtonElement | null;
const btnExportDiagnostics = document.getElementById('btn-export-diagnostics') as HTMLButtonElement | null;
const btnClearNativeLogs = document.getElementById('btn-clear-native-logs') as HTMLButtonElement | null;
const vpnSelfTestOutput = document.getElementById('vpn-self-test-output') as HTMLPreElement | null;
const linkInput = document.getElementById('link-input') as HTMLInputElement | null;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
const linksContainer = document.getElementById('links-container') as HTMLDivElement | null;
const statusText = document.getElementById('status-text') as HTMLSpanElement | null;
const btnDisconnect = document.getElementById('btn-disconnect') as HTMLButtonElement | null;
const btnPing = document.getElementById('btn-ping') as HTMLButtonElement | null;
const statusIpBox = document.getElementById('status-ip-box') as HTMLDivElement | null;
const statusIp = document.getElementById('status-ip') as HTMLSpanElement | null;
const defaultOutboundLabel = document.getElementById('default-outbound-label') as HTMLSpanElement | null;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement | null;
const sidebar = document.getElementById('sidebar') as HTMLDivElement | null;
const overlay = document.getElementById('overlay') as HTMLDivElement | null;
const sidebarItems = document.querySelectorAll('.sidebar-item');
const pages = document.querySelectorAll('.page-view');
const btnEditMode = document.getElementById('btn-edit-mode') as HTMLButtonElement | null;
const editBar = document.getElementById('edit-bar') as HTMLDivElement | null;
const importBar = document.getElementById('import-bar') as HTMLDivElement | null;
const columns = document.querySelectorAll<HTMLElement>('.route-column');
const searchModal = document.getElementById('search-modal') as HTMLDialogElement | null;
const modalSearch = document.getElementById('modal-search') as HTMLInputElement | null;
const searchResults = document.getElementById('search-results') as HTMLDivElement | null;
const manualInput = document.getElementById('manual-input') as HTMLInputElement | null;
const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement | null;
const themeLabel = document.getElementById('theme-label') as HTMLLabelElement | null;
const btnImportFile = document.getElementById('btn-import-file') as HTMLButtonElement | null;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement | null;
const toggleServerProxy = document.getElementById('toggle-server-proxy') as HTMLInputElement | null;
const androidAppRoutingSection = document.getElementById('android-app-routing-section') as HTMLDivElement | null;
const appRoutingModeSelect = document.getElementById('android-app-routing-mode') as HTMLSelectElement | null;
const appRoutingChoose = document.getElementById('android-app-routing-choose') as HTMLButtonElement | null;
const appRoutingSummary = document.getElementById('android-app-routing-summary') as HTMLSpanElement | null;
const appRoutingModal = document.getElementById('android-app-modal') as HTMLDialogElement | null;
const appRoutingSearch = document.getElementById('android-app-search') as HTMLInputElement | null;
const appRoutingList = document.getElementById('android-app-list') as HTMLDivElement | null;

const domType = document.getElementById('dns-dom-type') as HTMLSelectElement | null;
const domUrl = document.getElementById('dns-dom-url') as HTMLInputElement | null;
const domIp = document.getElementById('dns-dom-ip') as HTMLInputElement | null;
const remType = document.getElementById('dns-rem-type') as HTMLSelectElement | null;
const remUrl = document.getElementById('dns-rem-url') as HTMLInputElement | null;
const remIp = document.getElementById('dns-rem-ip') as HTMLInputElement | null;

const zones = { 
    direct: document.getElementById('zone-direct') as HTMLDivElement | null, 
    proxy: document.getElementById('zone-proxy') as HTMLDivElement | null, 
    block: document.getElementById('zone-block') as HTMLDivElement | null 
};

const langBtn = document.getElementById('lang-select-btn') as HTMLDivElement | null;
const langLabel = document.getElementById('lang-select-label') as HTMLSpanElement | null;
const langMenu = document.getElementById('lang-menu') as HTMLDivElement | null;

const langNames: Record<string, string> = {
    en: "English", ru: "Русский", fr: "Français", tr: "Türkçe", zh: "中文"
};

// **********************************
// DRAG AND DROP (ROUTING PRIORITY)
// **********************************
function applyColumnOrder() {
    const container = document.getElementById('routing-grid');
    if (!container) return;
    
    container.querySelectorAll('.routing-arrow').forEach(el => el.remove());
    
    zonePriority.forEach((zone, index) => {
        const col = document.querySelector(`.route-column[data-zone="${zone}"]`) as HTMLElement;
        if (col) {
            col.style.flex = "1";
            col.style.minWidth = "0";
            container.appendChild(col); 
            
            if (index < zonePriority.length - 1) {
                const arrow = document.createElement('div');
                arrow.className = 'routing-arrow';
                arrow.innerHTML = '➔';
                arrow.style.cssText = 'display: flex; align-items: center; justify-content: center; color: var(--accent); font-weight: bold; font-size: 20px; opacity: 0.5; padding: 0 5px; user-select: none; pointer-events: none;';
                container.appendChild(arrow);
            }
        }
    });
}

function applyColumnOrderWithAnimation() {
    const container = document.getElementById('routing-grid');
    if (!container) return;

    // 1. Снимаем координаты ДО изменения DOM
    const cols = Array.from(container.querySelectorAll('.route-column')) as HTMLElement[];
    const firstRects: Record<string, DOMRect> = {};
    cols.forEach(col => {
        firstRects[col.dataset.zone!] = col.getBoundingClientRect();
    });

    // 2. Меняем DOM
    applyColumnOrder();

    // 3. Снимаем координаты ПОСЛЕ изменения DOM и анимируем (FLIP)
    const newCols = Array.from(container.querySelectorAll('.route-column')) as HTMLElement[];
    newCols.forEach(col => {
        const first = firstRects[col.dataset.zone!];
        const last = col.getBoundingClientRect();
        
        if (first && last) {
            const deltaX = first.left - last.left;
            if (deltaX !== 0) {
                // Телепортируем на старое место без анимации
                col.style.transition = 'none';
                col.style.transform = `translateX(${deltaX}px)`;
                
                // Форсируем перерисовку кадра
                col.getBoundingClientRect();
                
                // Плавно едем на новое место
                requestAnimationFrame(() => {
                    col.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
                    col.style.transform = 'translateX(0)';
                });
            }
        }
    });
}

function initDragAndDrop() {
    const container = document.getElementById('routing-grid');
    if (!container) return;
    
    let draggedZone: ZoneKey | null = null;
    
    document.querySelectorAll<HTMLElement>('.route-column').forEach(col => {
        col.addEventListener('dragstart', (e: DragEvent) => {
            const target = (e.target as HTMLElement).closest('.route-column') as HTMLElement;
            if (!target) return;
            
            draggedZone = target.dataset.zone as ZoneKey;
            target.style.opacity = '0.3';
            
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedZone);
            }
        });
        
        col.addEventListener('dragend', (e: DragEvent) => {
            const target = (e.target as HTMLElement).closest('.route-column') as HTMLElement;
            if (target) target.style.opacity = '1';
            
            document.querySelectorAll('.route-column').forEach(c => {
                c.classList.remove('drag-over-left', 'drag-over-right');
                (c as HTMLElement).style.transform = '';
            });
            draggedZone = null;
        });
    });

    // Единый строгий математический контроллер на контейнере
    container.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault(); 
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (!draggedZone) return;

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const slotWidth = rect.width / 3;
        
        let hoverIndex = Math.floor(mouseX / slotWidth);
        hoverIndex = Math.max(0, Math.min(2, hoverIndex)); // Ограничиваем от 0 до 2
        
        const fromIndex = zonePriority.indexOf(draggedZone);
        
        // Сбрасываем эффекты со всех
        document.querySelectorAll('.route-column').forEach(c => {
            c.classList.remove('drag-over-left', 'drag-over-right');
        });

        // Навешиваем эффект только на тот блок, место которого мы хотим занять
        if (hoverIndex !== fromIndex) {
            const targetZone = zonePriority[hoverIndex];
            const targetCol = document.querySelector(`.route-column[data-zone="${targetZone}"]`) as HTMLElement;
            
            if (targetCol) {
                if (hoverIndex < fromIndex) {
                    // Тянем ВЛЕВО -> блок уступает вправо, подсвечивая левый край
                    targetCol.classList.add('drag-over-left');
                } else {
                    // Тянем ВПРАВО -> блок уступает влево, подсвечивая правый край
                    targetCol.classList.add('drag-over-right');
                }
            }
        }
    });

    container.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        if (!draggedZone) return;
        
        document.querySelectorAll('.route-column').forEach(c => {
            c.classList.remove('drag-over-left', 'drag-over-right');
            (c as HTMLElement).style.opacity = '1';
        });

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const slotWidth = rect.width / 3;
        let hoverIndex = Math.floor(mouseX / slotWidth);
        hoverIndex = Math.max(0, Math.min(2, hoverIndex));
        
        const fromIndex = zonePriority.indexOf(draggedZone);
        
        if (fromIndex !== hoverIndex) {
            zonePriority.splice(fromIndex, 1);
            zonePriority.splice(hoverIndex, 0, draggedZone);
            
            localStorage.setItem('karin_zone_priority', JSON.stringify(zonePriority));
            applyColumnOrderWithAnimation(); 
        }
        draggedZone = null;
    });
}

// **********************************
// SYSTEM FIXES (WEBKITGTK / WAYLAND ZOOM PREVENTION)
// **********************************
const preventNativeZoom = (e: Event) => {
    const wheelEvent = e as WheelEvent;
    const touchEvent = e as TouchEvent;
    const kbEvent = e as KeyboardEvent;

    if (e.type === 'keydown' && (kbEvent.ctrlKey || kbEvent.metaKey) && 
       (kbEvent.key === '+' || kbEvent.key === '-' || kbEvent.key === '=' || kbEvent.key === '0')) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if ((e.type === 'wheel' || e.type === 'mousewheel' || e.type === 'DOMMouseScroll') && 
       (wheelEvent.ctrlKey || wheelEvent.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (e.type === 'touchmove' && touchEvent.touches && touchEvent.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
    }
};

window.addEventListener('keydown', preventNativeZoom, { capture: true });
window.addEventListener('wheel', preventNativeZoom, { passive: false, capture: true });
window.addEventListener('mousewheel', preventNativeZoom, { passive: false, capture: true });
window.addEventListener('DOMMouseScroll', preventNativeZoom, { passive: false, capture: true });
window.addEventListener('touchmove', preventNativeZoom, { passive: false, capture: true });
window.addEventListener('gesturestart', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
window.addEventListener('gesturechange', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
window.addEventListener('gestureend', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true });

// **********************************
// INTERNATIONALIZATION (i18n)
// **********************************
function t(key: string): string { 
    return translations[currentLang]?.[key] || key; 
}

function updateUIStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => { 
        const key = el.getAttribute('data-i18n'); 
        if (key) el.textContent = t(key); 
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { 
        const key = el.getAttribute('data-i18n-placeholder'); 
        if (key) (el as HTMLInputElement).placeholder = t(key); 
    });
}

// **********************************
// KARIN TERMINAL ASSISTANT LOGIC
// **********************************
const karinConsole = document.getElementById('karin-msg') as HTMLSpanElement | null;
let karinTypingTimer: number | null = null;
let karinIdleTimer: number | null = null;

function typeKarinMessage(key: string) {
    if (!karinConsole) return;
    if (localStorage.getItem('karin_show_assistant') === 'false') return;
    const text = t(key);
    if (karinTypingTimer) window.clearInterval(karinTypingTimer);
    
    karinConsole.textContent = '';
    let i = 0;
    
    karinTypingTimer = window.setInterval(() => {
        karinConsole.textContent += text.charAt(i);
        i++;
        if (i >= text.length) {
            window.clearInterval(karinTypingTimer!);
            resetKarinIdleTimer();
        }
    }, 35);
}

function resetKarinIdleTimer() {
    if (karinIdleTimer) window.clearInterval(karinIdleTimer);
    karinIdleTimer = window.setInterval(() => {
        if (localStorage.getItem('karin_show_assistant') === 'false') return;
        const idleMessages = ['karin_idle_1', 'karin_idle_2', 'karin_idle_3', 'karin_idle_4', 'karin_idle_5', 'karin_idle_6', 'karin_idle_7', 'karin_idle_8', 'karin_idle_9', 'karin_idle_10', 'karin_idle_11', 'karin_idle_12', 'karin_idle_13', 'karin_idle_14', 'karin_idle_15', 'karin_idle_16', 'karin_idle_17', 'karin_idle_18', 'karin_idle_19', 'karin_idle_20'];
        const randomMsg = idleMessages[Math.floor(Math.random() * idleMessages.length)];
        typeKarinMessage(randomMsg);
    }, 25000); 
}

function applyKarinAssistantVisibility() {
    const consoleEl = document.querySelector('.karin-console') as HTMLElement | null;
    if (!consoleEl) return;
    const show = localStorage.getItem('karin_show_assistant') !== 'false';
    consoleEl.style.display = show ? '' : 'none';
}
applyKarinAssistantVisibility();

function initProfilesDrawer() {
    const trigger = document.getElementById('btn-open-profiles');
    const closeBtn = document.getElementById('btn-close-profiles');
    const drawer = document.getElementById('profiles-drawer');
    const overlay = document.getElementById('profiles-drawer-overlay');
    if (!trigger || !drawer || !overlay) return;

    const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); };
    const close = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); };

    trigger.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', close);

    return { open, close };
}
const profilesDrawer = initProfilesDrawer();

function getLinkDisplayName(url: string): string {
    let displayName = "Proxy";
    try {
        const u = new URL(url);
        if (u.protocol === 'ovpn:') {
            const encodedName = u.searchParams.get('name');
            displayName = encodedName ? decodeURIComponent(encodedName).replace('.ovpn', '') : `OpenVPN (${u.hostname})`;
        } else if (u.protocol === 'wg:') {
            const encodedName = u.searchParams.get('name');
            displayName = encodedName ? decodeURIComponent(encodedName).replace('.conf', '') : `WireGuard (${u.hostname})`;
        } else {
            displayName = `${u.hostname}:${u.port || '443'}`;
            if (u.hash) displayName = decodeURIComponent(u.hash.substring(1)) + ` (${u.hostname})`;
        }
    } catch (e) {
        displayName = url.substring(0, 30) + '...';
    }
    return displayName;
}

function updateHeroProfileName() {
    const el = document.getElementById('hero-profile-name');
    if (!el) return;
    const target = activeLink || selectedProfileUrl;
    if (target) {
        el.textContent = getLinkDisplayName(target);
        el.removeAttribute('data-i18n');
    } else {
        el.setAttribute('data-i18n', 'hero_no_profile');
        el.textContent = t('hero_no_profile');
    }
}

function initHeroCircle() {
    const circle = document.getElementById('hero-circle');
    circle?.addEventListener('click', () => {
        const isConnected = document.getElementById('status-text')?.className === 'status-active';
        if (isConnected) {
            disconnectProxy();
        } else if (selectedProfileUrl) {
            connectProxy(selectedProfileUrl);
        } else {
            profilesDrawer?.open();
        }
    });
}
initHeroCircle();

// **********************************
// CORE PROXY & DNS LOGIC
// **********************************
function saveDnsState() {
    if(!domType || !domUrl || !domIp || !remType || !remUrl || !remIp) return;
    localStorage.setItem('karin_dns_dom', JSON.stringify({ type: domType.value, url: domUrl.value, ip: domIp.value }));
    localStorage.setItem('karin_dns_rem', JSON.stringify({ type: remType.value, url: remUrl.value, ip: remIp.value }));
}

function loadDnsState() {
    if(!domType || !domUrl || !domIp || !remType || !remUrl || !remIp) return;
    const d = safeParse('karin_dns_dom', {type:"doh", url:"https://dns.yandex.ru/dns-query", ip:"77.88.8.8"});
    const r = safeParse('karin_dns_rem', {type:"doh", url:"https://1.1.1.1/dns-query", ip:"1.1.1.1"});
    domType.value = d.type || "doh"; domUrl.value = d.url || ""; domIp.value = d.ip || "";
    remType.value = r.type || "doh"; remUrl.value = r.url || ""; remIp.value = r.ip || "";
}

[domType, domUrl, domIp, remType, remUrl, remIp].forEach(el => el?.addEventListener('change', saveDnsState));

function mergeImportedRouting(imported: Record<ZoneKey, RoutingRule[]>) {
    (Object.keys(imported) as ZoneKey[]).forEach(zone => {
        if (!routingState[zone] || !imported[zone]) return;
        const existingValues = new Set(routingState[zone].map(r => r.value));
        imported[zone].forEach(rule => {
            if (!existingValues.has(rule.value)) {
                routingState[zone].push(rule);
                existingValues.add(rule.value);
            }
        });
    });
    renderRouting();
}

function mergeImportedDns(imported: { domestic?: DnsConfig; remote?: DnsConfig }) {
    if (imported.domestic && domType && domUrl && domIp) {
        domType.value = imported.domestic.type || domType.value;
        domUrl.value = imported.domestic.url || domUrl.value;
        domIp.value = imported.domestic.ip || domIp.value;
    }
    if (imported.remote && remType && remUrl && remIp) {
        remType.value = imported.remote.type || remType.value;
        remUrl.value = imported.remote.url || remUrl.value;
        remIp.value = imported.remote.ip || remIp.value;
    }
    saveDnsState();
}

async function saveNewLink() {
    if(!linkInput) return;
    const input = linkInput.value.trim();
    if (!input) return;
    
    const addLink = (url: string, groupId: string | null = null) => {
        if (!appLinks.find(l => l.url === url)) {
            appLinks.push({ id: 'link_' + Date.now() + Math.random(), url, pinned: false, groupId });
        }
    };
  
    if (input.startsWith('vless://') || input.startsWith('vmess://') || input.startsWith('trojan://') || input.startsWith('ss://')) {
        addLink(input); 
        saveData(); 
        renderLinks(); 
        linkInput.value = ''; 
        typeKarinMessage('karin_add_link');
        return;
    }
    
    if (input.startsWith('http://') || input.startsWith('https://')) {
        if(!btnSave) return;
        const originalText = btnSave.innerText; 
        btnSave.innerText = t('btn_saving') || 'Загрузка...'; 
        btnSave.disabled = true;
        
        try {
            const subscriptionRequest = invoke<SubscriptionResult>('fetch_subscription', { url: input });
            const uiWatchdog = new Promise<never>((_, reject) => {
                window.setTimeout(
                    () => reject(new Error('SUBSCRIPTION_UI_TIMEOUT')),
                    25_000
                );
            });
            const result = await Promise.race([subscriptionRequest, uiWatchdog]);
            const domain = new URL(input).hostname;
            const newGroupId = 'grp_' + Date.now();
            appGroups.push({ id: newGroupId, name: domain, pinned: false, isOpen: true });
            result.links.forEach(u => addLink(u, newGroupId));

            if (result.importedRouting) mergeImportedRouting(result.importedRouting);
            if (result.importedDns) mergeImportedDns(result.importedDns);

            saveData();
            renderLinks();
            linkInput.value = '';
            typeKarinMessage('karin_add_link');
        } catch (error) {
            const message = String(error);
            if (message.includes('SUBSCRIPTION_UI_TIMEOUT') || message.includes('SUBSCRIPTION_TIMEOUT')) {
                alert(t('err_subscription_timeout'));
            } else if (message.includes('SUBSCRIPTION_CONNECT')) {
                alert(`${t('err_subscription_connect')}\n\n${message}`);
            } else if (message.includes('certificate') || message.includes('tls') || message.includes('TLS')) {
                alert(`${t('err_subscription_tls')}\n\n${message}`);
            } else {
                alert(`${t('err_subscription_generic')}\n\n${message}`);
            }
        } finally { 
            btnSave.innerText = originalText; 
            btnSave.disabled = false; 
        }
        return;
    }
    alert(t('err_invalid_link'));
}

async function connectProxy(link: string) {
    try {
        if(statusText) statusText.innerText = t('status_connecting');
        const dDns = safeParse('karin_dns_dom', {type:"doh", url:"https://dns.yandex.ru/dns-query", ip:"77.88.8.8"});
        const rDns = safeParse('karin_dns_rem', {type:"doh", url:"https://1.1.1.1/dns-query", ip:"1.1.1.1"});
    
        if (appRoutingMode === 'allowlist' && selectedAppPackages.size === 0) {
            alert(t('settings_app_routing_required'));
            if(statusText) statusText.innerText = t('status_inactive');
            return;
        }

        const result = await invoke('start_proxy', { 
            vlessLink: link, 
            routingState: routingState, 
            defaultOutbound: defaultOutbound,
            dnsParams: { domestic: dDns, remote: rDns },
            allowServerProxy: allowServerProxy,
            zonePriority: zonePriority,
            proxyLan: allowProxyLan,
            killSwitch: runtimeInfo.platform !== 'android' && localStorage.getItem('karin_kill_switch') === 'true',
            appRoutingMode,
            appPackages: Array.from(selectedAppPackages)
        });
        
        if (result === "OK") {
            nativeVpnRunning = runtimeInfo.platform === 'android';
            nativeVpnStarting = false;
            nativeVpnCoreRunning = runtimeInfo.platform === 'android';
            nativeVpnReconnecting = false;
            activeLink = link;
            selectedProfileUrl = link;
            localStorage.setItem('karin_selected_profile', link);
            localStorage.setItem('karin_active_link', link);
            sessionStorage.setItem('karin_active_link', link); 
            updateStatusUI(); 
            renderLinks(); 
            typeKarinMessage('karin_connect_ok');
        }
    } catch (error) { 
        alert(`Core Error: ${error}`); 
        if(statusText) statusText.innerText = t('status_inactive'); 
        typeKarinMessage('karin_connect_fail');
    }
}

async function disconnectProxy() {
    try {
        await invoke('stop_proxy');
    } catch (error) {
        if (String(error).includes('ALWAYS_ON_VPN_ENABLED')) {
            alert(t('settings_android_disable_always_on_first'));
            return;
        }
        alert(`Core Error: ${error}`);
        return;
    }
    nativeVpnRunning = false;
    nativeVpnStarting = false;
    nativeVpnCoreRunning = false;
    nativeVpnReconnecting = false;
    activeLink = null;
    localStorage.removeItem('karin_active_link');
    sessionStorage.removeItem('karin_active_link'); 
    updateStatusUI(); 
    renderLinks(); 
    typeKarinMessage('karin_disconnect');
}

async function runVpnSelfTest() {
    if (!vpnSelfTestOutput || !btnVpnSelfTest) return;

    const original = btnVpnSelfTest.innerText;
    btnVpnSelfTest.disabled = true;
    btnVpnSelfTest.innerText = t('logs_self_test_running');
    vpnSelfTestOutput.style.display = 'block';
    vpnSelfTestOutput.textContent = t('logs_self_test_running');

    const lines: string[] = [];
    const mark = (ok: boolean) => ok ? '✓' : '✗';

    try {
        const status = await invoke<VpnRuntimeStatus>('get_vpn_runtime_status');
        const serviceActive = !!status.running || !!status.starting || !!status.reconnecting;
        const coreActive = !!status.coreRunning;
        const tunActive = typeof status.tunFd === 'number' && status.tunFd >= 0;

        lines.push(`${mark(serviceActive)} ${t('logs_self_test_service')}: ${serviceActive ? t('status_active') : t('status_inactive')}`);
        lines.push(`${mark(coreActive)} Xray: ${coreActive ? t('status_active') : t('status_inactive')}`);
        lines.push(`${mark(tunActive)} TUN: ${tunActive ? 'fd=' + status.tunFd : t('status_inactive')}`);

        if (status.reconnecting) {
            lines.push(`… ${t('logs_self_test_reconnecting')}`);
        }
        if (status.alwaysOn) {
            lines.push(`• Always-on: ${status.lockdown ? 'ON + lockdown' : 'ON'}`);
        }
        if (status.appRoutingMode) {
            lines.push(`• Per-app: ${status.appRoutingMode} (${status.appPackageCount || 0})`);
        }
        if (status.lastError) {
            lines.push(`! ${t('logs_self_test_last_error')}: ${status.lastError}`);
        }

        if (!coreActive || !tunActive) {
            lines.push('');
            lines.push(t('logs_self_test_not_connected'));
            vpnSelfTestOutput.textContent = lines.join('\n');
            return;
        }

        const [pingResult, ipv4Result, ipv6Result] = await Promise.allSettled([
            invoke<string>('check_ping'),
            invoke<string>('get_vpn_ipv4'),
            invoke<string>('get_vpn_ipv6')
        ]);

        if (pingResult.status === 'fulfilled') {
            lines.push(`✓ ${t('logs_self_test_proxy_path')}: ${pingResult.value}`);
        } else {
            lines.push(`✗ ${t('logs_self_test_proxy_path')}: ${String(pingResult.reason)}`);
        }

        if (ipv4Result.status === 'fulfilled') {
            lines.push(`✓ ${t('logs_self_test_ipv4')}: ${ipv4Result.value.trim()}`);
        } else {
            lines.push(`✗ ${t('logs_self_test_ipv4')}: ${String(ipv4Result.reason)}`);
        }

        if (ipv6Result.status === 'fulfilled') {
            lines.push(`✓ ${t('logs_self_test_ipv6')}: ${ipv6Result.value.trim()}`);
        } else {
            lines.push(`! ${t('logs_self_test_ipv6_unavailable')}: ${String(ipv6Result.reason)}`);
        }

        const passed = pingResult.status === 'fulfilled' && ipv4Result.status === 'fulfilled';
        lines.push('');
        lines.push(passed ? t('logs_self_test_ok') : t('logs_self_test_failed'));
        vpnSelfTestOutput.textContent = lines.join('\n');
    } catch (error) {
        vpnSelfTestOutput.textContent = `${t('logs_self_test_failed')}\n${String(error)}`;
    } finally {
        btnVpnSelfTest.disabled = false;
        btnVpnSelfTest.innerText = original;
    }
}

async function fetchLogs() {
    try {
        const logs = await invoke<string>('get_logs');
        if (logOutput) {
            const isScrolledToBottom = logOutput.scrollHeight - logOutput.clientHeight <= logOutput.scrollTop + 10;
            if (logs.trim() === "") {
                logOutput.textContent = t('logs_wait'); 
            } else {
                logOutput.textContent = logs;
            }
            if (isScrolledToBottom) logOutput.scrollTop = logOutput.scrollHeight;
        }
    } catch (err) { 
        console.error(err); 
    }
}

async function loadGeoCategories() { 
    try { 
        allAvailableTags = await invoke<string[]>('get_geosite_list'); 
    } catch (err) { 
        console.error(err); 
    } 
}

// **********************************
// UI RENDERING & HELPERS
// **********************************
function toggleMenu(show?: boolean) { 
    const isOpen = sidebar?.classList.contains('open'); 
    const shouldOpen = show !== undefined ? show : !isOpen; 
    sidebar?.classList.toggle('open', shouldOpen); 
    overlay?.classList.toggle('open', shouldOpen); 
}

function switchPage(pageId: string) { 
    pages.forEach(page => page.classList.toggle('active', page.id === pageId)); 
    toggleMenu(false); 
    
    if (pageId === 'page-logs' && toggleLogs?.checked) { 
        fetchLogs(); 
        logInterval = window.setInterval(fetchLogs, 1500) as unknown as number; 
    } else { 
        if (logInterval) { clearInterval(logInterval); logInterval = null; } 
    } 
}

let heroTextTimer: number | null = null;
function typeHeroCoreText(newText: string) {
    const el = document.getElementById('hero-core-text');
    if (!el) return;
    if (heroTextTimer) window.clearInterval(heroTextTimer);
    const prefix = '[ ~$ ';
    const suffix = ' ]';
    let i = 0;
    heroTextTimer = window.setInterval(() => {
        el.textContent = prefix + newText.slice(0, i) + suffix;
        i++;
        if (i > newText.length) window.clearInterval(heroTextTimer!);
    }, 100);
}

function updateStatusUI() {
    const heroCircle = document.getElementById('hero-circle');
    const wasConnected = heroCircle?.classList.contains('connected');
    const nowConnected = nativeVpnRunning || nativeVpnStarting || nativeVpnReconnecting || !!activeLink;
    heroCircle?.classList.toggle('connected', nowConnected);
    if (wasConnected !== nowConnected) {
        typeHeroCoreText(nowConnected ? 'connect' : 'null');
    }
    updateHeroProfileName();
    if (nowConnected) {
        if(statusText) {
            statusText.innerText = (nativeVpnStarting || nativeVpnReconnecting) ? t('status_connecting') : t('status_active');
            statusText.className = (nativeVpnStarting || nativeVpnReconnecting) ? "status-connecting" : "status-active";
        }
        if(btnDisconnect) btnDisconnect.style.display = "block";
        if(btnPing) {
            btnPing.style.display = nativeVpnCoreRunning || runtimeInfo.platform !== 'android' ? "block" : "none";
            btnPing.innerText = t('btn_ping');
        }
        if(statusIpBox) statusIpBox.style.display = nativeVpnCoreRunning || runtimeInfo.platform !== 'android' ? "block" : "none"; 
        if(statusIp) statusIp.innerText = "...";
        invoke<string>('get_vpn_ip').then(ip => { if(statusIp) statusIp.innerText = ip; }).catch(() => { if(statusIp) statusIp.innerText = "Error"; });
    } else {
        if(statusText) { statusText.innerText = t('status_inactive'); statusText.className = "status-inactive"; }
        if(btnDisconnect) btnDisconnect.style.display = "none"; 
        if(btnPing) btnPing.style.display = "none"; 
        if(statusIpBox) statusIpBox.style.display = "none";
    }
}

function updateDefaultOutboundUI() { 
    columns.forEach(col => { 
        const zone = col.dataset.zone; 
        if (zone === defaultOutbound) col.classList.add('active-default'); 
        else col.classList.remove('active-default'); 
    }); 
    
    if (defaultOutboundLabel) { 
        defaultOutboundLabel.innerText = defaultOutbound.charAt(0).toUpperCase() + defaultOutbound.slice(1); 
        if(defaultOutbound === 'direct') defaultOutboundLabel.style.color = 'var(--success)'; 
        if(defaultOutbound === 'proxy') defaultOutboundLabel.style.color = 'var(--accent)'; 
        if(defaultOutbound === 'block') defaultOutboundLabel.style.color = 'var(--danger)'; 
    } 
}

function formatProxyInfo(linkUrl: string): string {
    try {
        if (linkUrl.startsWith('vmess://')) { if (!linkUrl.includes('?')) return 'VMESS | Base64'; }
        const url = new URL(linkUrl); 
        const protocol = url.protocol.replace(':', '').toUpperCase();

        if (protocol === 'OVPN') {
            const proto = (url.searchParams.get('proto') || 'UDP').toUpperCase();
            const port = url.port || url.searchParams.get('port') || '1194';
            return `OpenVPN | ${proto} | ${port}`;
        }

        if (protocol === 'WG') {
            const ep = url.hostname;
            const port = url.port || '51820';
            return `WireGuard | UDP | ${ep}:${port}`;
        }

        const type = (url.searchParams.get('type') || 'TCP').toUpperCase();
        let security = url.searchParams.get('security') || 'NONE';
        if (security.toLowerCase() === 'tls') security = 'TLS'; 
        else if (security.toLowerCase() === 'reality') security = 'Reality'; 
        else security = security.toUpperCase();
        return `${protocol} | ${type} | ${security}`;
    } catch (e) { 
        return "Unknown Format"; 
    }
}

function showPrompt(title: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal') as HTMLDialogElement;
        const input = document.getElementById('prompt-input') as HTMLInputElement;
        const btnOk = document.getElementById('prompt-ok') as HTMLButtonElement;
        const btnCancel = document.getElementById('prompt-cancel') as HTMLButtonElement;
        const titleEl = document.getElementById('prompt-title') as HTMLHeadingElement;

        titleEl.textContent = title; 
        input.value = defaultValue; 
        modal.showModal(); 
        input.focus();

        const cleanup = () => {
            btnOk.removeEventListener('click', onOk); 
            btnCancel.removeEventListener('click', onCancel);
            modal.removeEventListener('cancel', onCancel); 
            input.removeEventListener('keydown', onKey);
        };
        const onOk = () => { cleanup(); modal.close(); resolve(input.value.trim()); };
        const onCancel = () => { cleanup(); modal.close(); resolve(null); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') onOk(); };

        btnOk.addEventListener('click', onOk); 
        btnCancel.addEventListener('click', onCancel);
        modal.addEventListener('cancel', onCancel); 
        input.addEventListener('keydown', onKey);
    });
}

function renderLinkItem(item: ProxyLink) {
    const isCurrentActive = activeLink === item.url;
    const isSelected = !isCurrentActive && selectedProfileUrl === item.url;
    let displayName = "Proxy";
    try {
        const url = new URL(item.url); 
        if (url.protocol === 'ovpn:') {
            const encodedName = url.searchParams.get('name');
            if (encodedName) {
                displayName = decodeURIComponent(encodedName).replace('.ovpn', '');
            } else {
                displayName = `OpenVPN (${url.hostname})`;
            }
        } else if (url.protocol === 'wg:') {
            const encodedName = url.searchParams.get('name');
            if (encodedName) {
                displayName = decodeURIComponent(encodedName).replace('.conf', '');
            } else {
                displayName = `WireGuard (${url.hostname})`;
            }
        } else {
            displayName = `${url.hostname}:${url.port || '443'}`;
            if (url.hash) displayName = decodeURIComponent(url.hash.substring(1)) + ` (${url.hostname})`;
        }
    }   catch (e) { 
            displayName = item.url.substring(0, 30) + '...'; 
    }

    const formattedProtocol = formatProxyInfo(item.url);
    const pinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
    const checkboxHtml = isEditMode ? `<input type="checkbox" class="edit-checkbox" data-id="${item.id}" ${selectedLinks.has(item.id) ? 'checked' : ''}>` : '';
    const actionsHtml = isEditMode ? '' : `
        <button class="btn-menu-dots" data-index="${item.id}">⋮</button>
        <div class="dropdown-menu" id="menu-${item.id}" style="display:none;">
          <button class="btn-share" data-url="${item.url}">${t('btn_share')}</button>
          <button class="btn-pin" data-id="${item.id}">${item.pinned ? t('btn_unpin') : t('btn_pin')}</button>
          <button class="btn-delete-link danger" style="background: transparent; color: var(--danger);" data-id="${item.id}">${t('btn_delete')}</button>
        </div>
    `;

    return `
      <div class="link-item ${isSelected ? 'link-item-selected' : ''}" data-select-url="${item.url}" style="${isEditMode ? '' : 'cursor: pointer;'}">
        ${checkboxHtml}
        <div class="link-info">
          <div class="link-name" style="font-size: 14.5px; display: flex; align-items: center; ${isCurrentActive ? 'color: var(--success); font-weight: bold;' : 'font-weight: 500;'}">
            ${item.pinned && !item.groupId ? pinIcon : ''}${displayName}
          </div>
          <div class="link-url" style="font-size: 12px; color: var(--text-dim); opacity: 0.95; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; letter-spacing: 0.3px;">
            ${formattedProtocol}
          </div>
        </div>
        <div class="link-actions">${actionsHtml}</div>
      </div>
    `;
}

function renderLinks() {
    if(!linksContainer) return;
    linksContainer.innerHTML = '';
    
    if (appLinks.length === 0) { 
     linksContainer.innerHTML = `
       <div class="empty-state">
           <img src="/karin-empty.png" alt="Karin" class="empty-state-img">
           <div class="empty-state-text">
               ${t('empty_state_text')}
           </div>
       </div>`; 
     return; 
    }
  
    const pinnedGroups = appGroups.filter(g => g.pinned);
    const unpinnedGroups = appGroups.filter(g => !g.pinned);
    
    const renderGroup = (g: ProxyGroup) => {
        const gLinks = appLinks.filter(l => l.groupId === g.id);
        if (gLinks.length === 0) return ''; 
        const pinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
        
        let html = `
          <div class="group-header" data-id="${g.id}">
              <div style="display: flex; align-items: center; gap: 8px;">
                  ${isEditMode ? `<input type="checkbox" class="edit-checkbox" data-group-id="${g.id}" ${selectedGroups.has(g.id) ? 'checked' : ''} onclick="event.stopPropagation()">` : ''}
                  ${g.pinned ? pinIcon : ''} <span>${g.name}</span> <span style="font-size:12px; color:var(--text-dim);">(${gLinks.length})</span>
              </div>
              <div style="display:flex; gap:10px;">
                  <span style="color:var(--text-dim); transition: transform 0.2s; transform: ${g.isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};">▼</span>
              </div>
          </div>
        `;
        if (g.isOpen) {
            html += `<div class="group-content">` + gLinks.map(l => renderLinkItem(l)).join('') + `</div>`;
        }
        return html;
    };
  
    let html = '';
    pinnedGroups.forEach(g => html += renderGroup(g));
    appLinks.filter(l => l.groupId === null && l.pinned).forEach(l => html += renderLinkItem(l));
    unpinnedGroups.forEach(g => html += renderGroup(g));
    appLinks.filter(l => l.groupId === null && !l.pinned).forEach(l => html += renderLinkItem(l));
  
    linksContainer.innerHTML = html;
    
    document.querySelectorAll('.edit-checkbox[data-group-id]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const gId = (e.target as HTMLInputElement).dataset.groupId!;
            const isChecked = (e.target as HTMLInputElement).checked;
            
            if (isChecked) selectedGroups.add(gId); else selectedGroups.delete(gId);
            
            appLinks.filter(l => l.groupId === gId).forEach(l => {
                if (isChecked) selectedLinks.add(l.id); else selectedLinks.delete(l.id);
            });
            renderLinks();
        });
    });
}

function renderRouting() { 
    Object.keys(zones).forEach(key => { 
        const zone = zones[key as keyof typeof zones]; 
        if(zone) { 
            zone.innerHTML = `<button class="btn-add" data-zone="${key}">+</button>`; 
            if (routingState[key as ZoneKey]) {
                routingState[key as ZoneKey].forEach((rule: any) => { 
                    const el = document.createElement('div'); 
                    el.className = 'tag-item'; 
                    el.innerHTML = `${rule.value} <span class="btn-delete-tag" data-tag="${rule.value}" data-zone="${key}" style="pointer-events: auto;">×</span>`; 
                    zone.appendChild(el); 
                }); 
            }
        }
    }); 
    localStorage.setItem('karin_routing', JSON.stringify(routingState)); 
}

function renderRoutingProfiles() {
    const list = document.getElementById('routing-profiles-list');
    if (!list) return;
    list.innerHTML = '';
    routeProfiles.forEach(p => {
        list.innerHTML += `
            <div class="profile-item">
                <span>${p.name}</span>
                <div class="link-actions">
                    <button class="secondary btn-load-profile" data-id="${p.id}" style="padding: 6px 12px; font-size: 13px;">${t('btn_select')}</button>
                    <button class="btn-menu-dots btn-route-menu-dots" data-index="${p.id}">⋮</button>
                    <div class="dropdown-menu" id="route-menu-${p.id}" style="display:none;">
                        <button class="btn-edit-profile" data-id="${p.id}">${t('btn_rename')}</button>
                        <button class="btn-export-profile" data-id="${p.id}">${t('btn_share')}</button>
                        <button class="btn-del-profile danger" style="background: transparent; color: var(--danger);" data-id="${p.id}">${t('btn_delete')}</button>
                    </div>
                </div>
            </div>
        `;
    });
}

function renderAboutPage() {
    const infoPanel = document.getElementById('about-info-panel');
    const patchPanel = document.getElementById('about-patch-panel');

    if (infoPanel) {
        infoPanel.innerHTML = `
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <img src="/karin-about.png" alt="KarinCore" style="width: 90px; height: 90px; border-radius: 16px; object-fit: cover; border: 2px solid var(--accent); box-shadow: 0 0 15px rgba(203, 166, 247, 0.15);">
                <div>
                    <h2 style="margin: 0; color: var(--accent); font-weight: 600; font-size: 26px; letter-spacing: 0.5px;">KarinCore</h2>
                    <div style="font-size: 13px; color: var(--success); margin-top: 4px; font-family: monospace;">KarinCore Android v${runtimeInfo.version}</div>
                </div>
            </div>
            
            <div class="tab-scroll-content" style="font-size: 14px; line-height: 1.6; color: var(--text-color); display: flex; flex-direction: column; gap: 16px; padding-bottom: 30px;">
                <p style="margin: 0; text-align: justify;">${t('about_p1')}</p>
                
                <div>
                    <h4 style="margin: 0 0 2px 0; color: var(--accent); font-size: 15px; font-weight: 600;">${t('about_manifest_title')}</h4>
                    <p style="margin: 0; text-align: justify;">${t('about_manifest_p1')}</p>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 2px 0; color: var(--accent); font-size: 15px; font-weight: 600;">${t('about_roadmap_title')}</h4>
                    <p style="margin: 0; padding-left: 10px; border-left: 2px solid var(--border-color); text-align: justify;">${t('about_roadmap_p1')}</p>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 2px 0; color: var(--accent); font-size: 15px; font-weight: 600;">${t('about_support_title')}</h4>
                    <p style="margin: 0; text-align: justify;">${t('about_support_p1')}</p>
                </div>
                
                <div style="background: var(--base-crust); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
                    <div><span style="color: var(--accent);">• ${t('about_author')}:</span> VivaGushter</div>
                    <div><span style="color: var(--accent);">• GitHub:</span> <span class="copyable-item" data-copy="https://github.com/${PROJECT_REPO}" style="color: var(--text-color);">https://github.com/${PROJECT_REPO}</span></div>
                    <div><span style="color: var(--accent);">• Upstream:</span> <span class="copyable-item" data-copy="https://github.com/${UPSTREAM_REPO}" style="color: var(--text-dim);">https://github.com/${UPSTREAM_REPO}</span></div>
                </div>
                
                <div style="margin-top: 4px; background: var(--base-crust); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px; flex-shrink: 0; position: relative; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--success);"></div>
                    <h4 style="margin: 0 0 10px 0; color: var(--success); font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        ${t('about_legal_title')}
                    </h4>
                    <div style="font-size: 13px; color: var(--text-color); line-height: 1.6; text-align: justify; font-family: monospace;">
                        <span style="color: var(--accent);">[COPYRIGHT]</span> ${t('about_legal_copyright')}<br><br>
                        <span style="color: var(--accent);">[ZERO TELEMETRY]</span> ${t('about_legal_privacy')}
                    </div>
                </div>
            </div>
        `;

        const copyItems = infoPanel.querySelectorAll('.copyable-item');
        copyItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                const textToCopy = target.getAttribute('data-copy');
                
                if (textToCopy) {
                    try {
                        await navigator.clipboard.writeText(textToCopy);
                        
                        const originalText = target.innerText;
                        const originalColor = target.style.color;
                        
                        target.innerText = t('btn_copied');
                        target.style.color = 'var(--accent)';
                        
                        setTimeout(() => {
                            target.innerText = originalText;
                            target.style.color = originalColor;
                        }, 1500);
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        });
    }

    if (patchPanel) {
        patchPanel.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                ${t('patch_notes')}
            </h3>
            
            <div class="patch-scroll-area" style="overflow-y: auto; flex: 1; padding-right: 10px; font-size: 13px; color: var(--text-dim); line-height: 1.6; white-space: pre-wrap; padding-bottom: 30px;">${t('about_text_2')}</div>
        `;
    }
}

function renderSearchResults(tags: string[]) { 
    if(!searchResults || !modalSearch) return; 
    searchResults.innerHTML = ''; 
    tags.slice(0, 10).forEach(tag => { 
        const el = document.createElement('div'); 
        el.className = 'tag-item'; 
        el.innerText = tag; 
        el.onclick = () => { 
            addRule(tag, 'geosite'); 
            searchModal?.close(); 
            modalSearch.value = ''; 
        }; 
        searchResults.appendChild(el); 
    }); 
}

function handleManualAdd() { 
    if(!manualInput) return; 
    let val = manualInput.value.trim().toLowerCase(); 
    if (!val) return; 
    
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(3[0-2]|[1-2]?[0-9]))?$/; 
    const domainRegex = /^(domain:|full:|keyword:|regexp:)?([a-zA-Z0-9\-\.\_\*]+)$/; 
    let type = ''; 
    
    if (ipRegex.test(val)) type = 'ip'; 
    else if (domainRegex.test(val)) type = 'domain'; 
    else { alert(t('err_invalid_rule')); return; } 
    
    addRule(val, type); 
    manualInput.value = ''; 
}

function addRule(value: string, type: string) { 
    routingState[currentZone as ZoneKey].push({ type, value }); 
    renderRouting(); 
    searchModal?.close(); 
}

// **********************************
// APPLICATION UPDATE CHECKER
// **********************************
function compareProjectVersions(left: string, right: string): number {
    const parse = (value: string) => {
        const normalized = value.trim().replace(/^v/, '');
        const [core, prerelease = ''] = normalized.split('-', 2);
        return {
            core: core.split('.').map(part => Number.parseInt(part, 10) || 0),
            prerelease: prerelease ? prerelease.split('.') : []
        };
    };

    const a = parse(left);
    const b = parse(right);
    const width = Math.max(a.core.length, b.core.length);

    for (let i = 0; i < width; i++) {
        const av = a.core[i] || 0;
        const bv = b.core[i] || 0;
        if (av !== bv) return av > bv ? 1 : -1;
    }

    if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
    if (a.prerelease.length === 0) return 1;
    if (b.prerelease.length === 0) return -1;

    const preWidth = Math.max(a.prerelease.length, b.prerelease.length);
    for (let i = 0; i < preWidth; i++) {
        const av = a.prerelease[i];
        const bv = b.prerelease[i];
        if (av === undefined) return -1;
        if (bv === undefined) return 1;
        if (av === bv) continue;

        const an = /^\d+$/.test(av) ? Number.parseInt(av, 10) : null;
        const bn = /^\d+$/.test(bv) ? Number.parseInt(bv, 10) : null;

        if (an !== null && bn !== null) return an > bn ? 1 : -1;
        if (an !== null) return -1;
        if (bn !== null) return 1;
        return av.localeCompare(bv);
    }

    return 0;
}

async function checkApplicationUpdates() {
    const statusEl = document.getElementById('update-status');
    if (!statusEl) return;

    const repo = PROJECT_REPO;
    const versionUrl = `https://raw.githubusercontent.com/${repo}/main/VERSION?_=${Date.now()}`;

    try {
        const response = await fetch(versionUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`VERSION_HTTP_${response.status}`);

        const latestVersion = (await response.text()).trim().replace(/^v/, '');
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(latestVersion)) {
            throw new Error('VERSION_FORMAT_INVALID');
        }

        const relation = compareProjectVersions(latestVersion, runtimeInfo.version);
        if (relation <= 0) {
            statusEl.innerHTML = `<span style="opacity: 0.6;">v${runtimeInfo.version} · ${t('update_current')}</span>`;
            return;
        }

        const releaseUrl = `https://github.com/${repo}/releases/tag/v${encodeURIComponent(latestVersion)}`;
        statusEl.innerHTML = `
            <a class="update-link" href="${releaseUrl}" target="_blank">
                v${runtimeInfo.version} → v${latestVersion} · ${t('update_available')}
                <span class="notification-dot"></span>
            </a>
        `;

        statusEl.querySelector('.update-link')?.addEventListener('click', (event) => {
            event.preventDefault();
            invoke('open_browser', { url: releaseUrl }).catch(console.error);
        });
    } catch (error) {
        console.error('Update check failed:', error);
        statusEl.innerHTML = `<span style="opacity:0.6;">v${runtimeInfo.version}</span>`;
    }
}

function saveAppRoutingSettings() {
    localStorage.setItem('karin_app_routing_mode', JSON.stringify(appRoutingMode));
    localStorage.setItem('karin_app_packages', JSON.stringify(Array.from(selectedAppPackages)));
}

function renderAppRoutingSummary() {
    if (!appRoutingSummary || !appRoutingChoose) return;
    const selected = selectedAppPackages.size;
    appRoutingSummary.textContent = `${selected} ${t('settings_app_routing_selected')}`;
    appRoutingChoose.disabled = appRoutingMode === 'all';
    appRoutingChoose.style.opacity = appRoutingMode === 'all' ? '0.55' : '1';
}

function renderInstalledApps(filter = '') {
    if (!appRoutingList) return;
    appRoutingList.innerHTML = '';
    const query = filter.trim().toLowerCase();

    installedApps
        .filter(app => !query || app.label.toLowerCase().includes(query) || app.packageName.toLowerCase().includes(query))
        .forEach(app => {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedAppPackages.has(app.packageName);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selectedAppPackages.add(app.packageName);
                else selectedAppPackages.delete(app.packageName);
                saveAppRoutingSettings();
                renderAppRoutingSummary();
            });

            const text = document.createElement('div');
            text.style.cssText = 'min-width:0;flex:1;';

            const label = document.createElement('div');
            label.textContent = app.label;
            label.style.cssText = 'font-size:13px;color:var(--text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            const pkg = document.createElement('div');
            pkg.textContent = app.packageName + (app.system ? ` · ${t('settings_app_routing_system')}` : '');
            pkg.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

            text.append(label, pkg);
            row.append(checkbox, text);
            appRoutingList.appendChild(row);
        });
}

function renderAndroidSystemVpnStatus() {
    const section = document.getElementById('android-system-vpn-section') as HTMLDivElement | null;
    const desktopSection = document.getElementById('desktop-kill-switch-section') as HTMLDivElement | null;
    const status = document.getElementById('android-system-vpn-status') as HTMLDivElement | null;

    if (runtimeInfo.platform !== 'android') {
        if (section) section.style.display = 'none';
        if (desktopSection) desktopSection.style.display = 'block';
        return;
    }

    if (section) section.style.display = 'block';
    if (desktopSection) desktopSection.style.display = 'none';

    if (status) {
        status.textContent = nativeVpnLockdown
            ? t('settings_android_lockdown_on')
            : nativeVpnAlwaysOn
                ? t('settings_android_always_on')
                : t('settings_android_always_off');
    }
}

async function initAndroidAppRouting() {
    try {
        const apps = await invoke<InstalledApp[]>('get_installed_apps');
        if (!Array.isArray(apps) || apps.length === 0) return;

        installedApps = apps;
        if (androidAppRoutingSection) androidAppRoutingSection.style.display = 'block';
        if (appRoutingModeSelect) appRoutingModeSelect.value = appRoutingMode;

        const installedPackageNames = new Set(installedApps.map(app => app.packageName));
        selectedAppPackages = new Set(Array.from(selectedAppPackages).filter(pkg => installedPackageNames.has(pkg)));
        saveAppRoutingSettings();
        renderAppRoutingSummary();
        renderInstalledApps();
    } catch (error) {
        console.debug('Per-app routing is unavailable on this platform:', error);
    }
}

// **********************************
// INITIALIZATION & EVENT LISTENERS
// **********************************
async function restoreAndroidVpnState() {
    if (runtimeInfo.platform !== 'android') return;

    try {
        const status = await invoke<VpnRuntimeStatus>('get_vpn_runtime_status');
        nativeVpnRunning = !!status.running;
        nativeVpnStarting = !!status.starting;
        nativeVpnCoreRunning = !!status.coreRunning;
        nativeVpnReconnecting = !!status.reconnecting;
        nativeVpnAlwaysOn = !!status.alwaysOn;
        nativeVpnLockdown = !!status.lockdown;
        renderAndroidSystemVpnStatus();

        const nativeActive = nativeVpnRunning || nativeVpnStarting || nativeVpnCoreRunning || nativeVpnReconnecting;
        if (nativeActive) {
            const persistedActiveLink = localStorage.getItem('karin_active_link');
            activeLink = persistedActiveLink || selectedProfileUrl || activeLink;
            if (activeLink) {
                sessionStorage.setItem('karin_active_link', activeLink);
            }
        } else {
            activeLink = null;
            localStorage.removeItem('karin_active_link');
            sessionStorage.removeItem('karin_active_link');
        }

        if (status.lastError) {
            console.debug('Native VPN status:', status.lastError);
        }
    } catch (error) {
        console.debug('Unable to restore Android VPN state:', error);
        nativeVpnRunning = false;
        nativeVpnStarting = false;
        nativeVpnCoreRunning = false;
        nativeVpnReconnecting = false;
        nativeVpnAlwaysOn = false;
        nativeVpnLockdown = false;
        renderAndroidSystemVpnStatus();
        activeLink = null;
        sessionStorage.removeItem('karin_active_link');
    }
}

async function pollAndroidVpnState() {
    if (runtimeInfo.platform !== 'android' || document.visibilityState !== 'visible' || nativeStatusPollInFlight) {
        return;
    }

    nativeStatusPollInFlight = true;
    try {
        const status = await invoke<VpnRuntimeStatus>('get_vpn_runtime_status');
        const signature = [
            status.running,
            status.starting,
            status.coreRunning,
            status.reconnecting,
            status.alwaysOn,
            status.lockdown,
            status.lastError || ''
        ].join('|');

        if (signature === lastNativeStatusSignature) return;
        lastNativeStatusSignature = signature;

        nativeVpnRunning = !!status.running;
        nativeVpnStarting = !!status.starting;
        nativeVpnCoreRunning = !!status.coreRunning;
        nativeVpnReconnecting = !!status.reconnecting;
        nativeVpnAlwaysOn = !!status.alwaysOn;
        nativeVpnLockdown = !!status.lockdown;

        const nativeActive = nativeVpnRunning || nativeVpnStarting || nativeVpnCoreRunning || nativeVpnReconnecting;
        if (!nativeActive) {
            activeLink = null;
            localStorage.removeItem('karin_active_link');
            sessionStorage.removeItem('karin_active_link');
        } else if (!activeLink) {
            const persistedActiveLink = localStorage.getItem('karin_active_link');
            activeLink = persistedActiveLink || selectedProfileUrl || null;
        }

        renderAndroidSystemVpnStatus();
        updateStatusUI();

        if (status.lastError) {
            console.debug('Native VPN runtime error:', status.lastError);
        }
    } catch (error) {
        console.debug('Android VPN status poll failed:', error);
    } finally {
        nativeStatusPollInFlight = false;
    }
}

function startAndroidVpnStateMonitor() {
    if (nativeStatusInterval !== null) {
        window.clearInterval(nativeStatusInterval);
        nativeStatusInterval = null;
    }

    if (runtimeInfo.platform !== 'android') return;

    void pollAndroidVpnState();
    nativeStatusInterval = window.setInterval(() => {
        void pollAndroidVpnState();
    }, 2500);
}

async function init() {
    try {
        runtimeInfo = await invoke<RuntimeInfo>('get_runtime_info');
        runtimeInfo.updateRepo = PROJECT_REPO;
    } catch (error) {
        console.debug('Runtime metadata unavailable:', error);
    }

    document.documentElement.classList.toggle('platform-android', runtimeInfo.platform === 'android');
    if (androidLogActions) {
        androidLogActions.style.display = runtimeInfo.platform === 'android' ? 'flex' : 'none';
    }
    renderAndroidSystemVpnStatus();
    await restoreAndroidVpnState();
    startAndroidVpnStateMonitor();

    const versionNodes = document.querySelectorAll('.app-version-text');
    versionNodes.forEach(node => { node.textContent = `v ${runtimeInfo.version}`; });

    if (runtimeInfo.platform !== 'android') {
        document.getElementById('titlebar-minimize')?.addEventListener('click', () => invoke('minimize_window'));
        document.getElementById('titlebar-maximize')?.addEventListener('click', () => invoke('maximize_window'));
        document.getElementById('titlebar-close')?.addEventListener('click', () => invoke('close_window'));
    }

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.visibility = 'hidden';
                typeKarinMessage('karin_greet');
            }, 500);
        }
    }, 1500);  

    updateUIStrings();
    if (langLabel) langLabel.textContent = langNames[currentLang] || "English";
    
    // Инициализация Drag and Drop для колонок маршрутизации
    initDragAndDrop();
    applyColumnOrder();

    renderLinks(); 
    updateStatusUI(); 
    updateDefaultOutboundUI(); 
    renderRouting(); 
    loadGeoCategories(); 
    renderAboutPage();
    loadDnsState(); 
    renderRoutingProfiles();
    void initAndroidAppRouting();
    
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.checked = true;
        if (themeLabel) {
            themeLabel.setAttribute('data-i18n', 'theme_light');
            themeLabel.textContent = t('theme_light');
        }
    } else {
        if (themeLabel) {
            themeLabel.setAttribute('data-i18n', 'theme_dark');
            themeLabel.textContent = t('theme_dark');
        }
    }
    
    langBtn?.addEventListener('click', () => {
        if (langMenu) {
            const isO = langMenu.style.display === 'flex';
            document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
            langMenu.style.display = isO ? 'none' : 'flex';
        }
    });

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            currentLang = target.dataset.value!;
            if (langLabel) langLabel.textContent = target.textContent;
            if (langMenu) langMenu.style.display = 'none';
            
            localStorage.setItem('karin_lang', currentLang);
            updateUIStrings(); 
            renderLinks(); 
            updateStatusUI(); 
            renderAboutPage();
            renderRoutingProfiles();
            checkApplicationUpdates();
        });
    });

    if (toggleServerProxy) {
        toggleServerProxy.checked = allowServerProxy;
        toggleServerProxy.addEventListener('change', (e) => {
            allowServerProxy = (e.target as HTMLInputElement).checked;
            localStorage.setItem('karin_allow_server_proxy', JSON.stringify(allowServerProxy));
        });
    }

    const toggleProxyLan = document.getElementById('toggle-proxy-lan') as HTMLInputElement | null;
    if (toggleProxyLan) {
        toggleProxyLan.checked = allowProxyLan;
        toggleProxyLan.addEventListener('change', (e) => {
            allowProxyLan = (e.target as HTMLInputElement).checked;
            localStorage.setItem('karin_allow_proxy_lan', JSON.stringify(allowProxyLan));
        });
    }

    themeToggle?.addEventListener('change', (e) => {
        const isLight = (e.target as HTMLInputElement).checked;
        if (isLight) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('karin_theme', 'light');
            currentTheme = 'light';
            if (themeLabel) {
                themeLabel.setAttribute('data-i18n', 'theme_light');
                themeLabel.textContent = t('theme_light');
            }
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('karin_theme', 'dark');
            currentTheme = 'dark';
            if (themeLabel) {
                themeLabel.setAttribute('data-i18n', 'theme_dark');
                themeLabel.textContent = t('theme_dark');
            }
        }
    });

    const karinAssistantToggle = document.getElementById('karin-assistant-toggle') as HTMLInputElement | null;
    if (karinAssistantToggle) {
        karinAssistantToggle.checked = localStorage.getItem('karin_show_assistant') !== 'false';
        karinAssistantToggle.addEventListener('change', (e) => {
            const show = (e.target as HTMLInputElement).checked;
            localStorage.setItem('karin_show_assistant', show ? 'true' : 'false');
            applyKarinAssistantVisibility();
        });
    }

    appRoutingModeSelect?.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value as AppRoutingMode;
        appRoutingMode = ['all', 'allowlist', 'denylist'].includes(value) ? value : 'all';
        saveAppRoutingSettings();
        renderAppRoutingSummary();
    });

    appRoutingChoose?.addEventListener('click', () => {
        if (appRoutingMode === 'all') return;
        renderInstalledApps(appRoutingSearch?.value || '');
        appRoutingModal?.showModal();
    });

    appRoutingSearch?.addEventListener('input', () => {
        renderInstalledApps(appRoutingSearch.value);
    });

    document.getElementById('android-app-modal-close')?.addEventListener('click', () => {
        appRoutingModal?.close();
    });

    document.getElementById('android-vpn-settings-btn')?.addEventListener('click', async () => {
        try {
            await invoke('open_android_vpn_settings');
        } catch (error) {
            alert(`${t('settings_android_vpn_settings_error')}: ${error}`);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (runtimeInfo.platform !== 'android') return;

        if (document.visibilityState === 'visible') {
            void restoreAndroidVpnState().then(() => {
                updateStatusUI();
                lastNativeStatusSignature = '';
                startAndroidVpnStateMonitor();
            });
        } else if (nativeStatusInterval !== null) {
            window.clearInterval(nativeStatusInterval);
            nativeStatusInterval = null;
        }
    });

    const killSwitchToggle = document.getElementById('kill-switch-toggle') as HTMLInputElement | null;
    if (killSwitchToggle) {
        killSwitchToggle.checked = localStorage.getItem('karin_kill_switch') === 'true';
        killSwitchToggle.addEventListener('change', (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            localStorage.setItem('karin_kill_switch', enabled ? 'true' : 'false');
        });
    }
    
    btnSave?.addEventListener('click', saveNewLink);
    btnImportFile?.addEventListener('click', () => { importFileInput?.click(); });

    importFileInput?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const isOvpn = file.name.toLowerCase().endsWith('.ovpn');
        const isWg = file.name.toLowerCase().endsWith('.conf');

        if (!isOvpn && !isWg) {
            alert(t('err_invalid_file_type') || 'Ошибка: Выберите файл .ovpn или .conf');
            if (importFileInput) importFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            const safeName = encodeURIComponent(file.name);
            const payload = btoa(unescape(encodeURIComponent(content)));
            let finalLink = "";

            if (isOvpn) {
                let remote = "Unknown";
                let port = "1194";
                let proto = "UDP";

                const lines = content.split('\n').map(l => l.trim().toLowerCase());
                const protoLine = lines.find(l => l.startsWith('proto '));
                if (protoLine) {
                    if (protoLine.includes('tcp')) proto = 'TCP';
                    else if (protoLine.includes('udp')) proto = 'UDP';
                }
                const remoteLine = lines.find(l => l.startsWith('remote '));
                if (remoteLine) {
                    const parts = remoteLine.split(/\s+/);
                    if (parts.length >= 2) remote = parts[1];
                    if (parts.length >= 3) {
                        const p = parseInt(parts[2]);
                        if (!isNaN(p)) port = parts[2];
                    }
                }
                const portLine = lines.find(l => l.startsWith('port '));
                if (portLine) {
                    const parts = portLine.split(/\s+/);
                    if (parts.length >= 2) port = parts[1];
                }
                finalLink = `ovpn://${remote}:${port}?proto=${proto}&name=${safeName}&payload=${encodeURIComponent(payload)}`;
            } 
            else if (isWg) {
                let endpoint = "Unknown";
                const lines = content.split('\n').map(l => l.trim().toLowerCase());
                const endpointLine = lines.find(l => l.startsWith('endpoint'));
                if (endpointLine) {
                    const epParts = endpointLine.split('=');
                    if (epParts.length > 1) {
                        endpoint = epParts[1].trim();
                    }
                }
                finalLink = `wg://${endpoint}?name=${safeName}&payload=${encodeURIComponent(payload)}`;
            }

            if (!appLinks.find(l => l.url === finalLink)) {
                appLinks.push({ id: 'link_' + Date.now() + Math.random(), url: finalLink, pinned: false, groupId: null });
                saveData();
                renderLinks();
            } else {
                alert("Этот профиль уже добавлен!");
            }

            if (importFileInput) importFileInput.value = '';
        };
        reader.readAsText(file);
    });
    
    btnDisconnect?.addEventListener('click', disconnectProxy);
    document.getElementById('btn-manual-add')?.addEventListener('click', handleManualAdd);
    btnMenu?.addEventListener('click', () => toggleMenu());
    overlay?.addEventListener('click', () => toggleMenu(false));
  
    sidebarItems.forEach(item => { 
        item.addEventListener('click', (e) => { 
            const targetPage = (e.currentTarget as HTMLElement).dataset.target; 
            if (targetPage) switchPage(targetPage); 
        }); 
    });
  
    btnVpnSelfTest?.addEventListener('click', () => {
        void runVpnSelfTest();
    });

    btnExportDiagnostics?.addEventListener('click', async () => {
        const original = btnExportDiagnostics.innerText;
        btnExportDiagnostics.disabled = true;
        btnExportDiagnostics.innerText = t('logs_exporting');

        try {
            const result = await invoke<string>('export_diagnostics');
            alert(result);
        } catch (error) {
            if (String(error) !== 'Отменено') {
                alert(`${t('logs_export_failed')}: ${error}`);
            }
        } finally {
            btnExportDiagnostics.disabled = false;
            btnExportDiagnostics.innerText = original;
        }
    });

    btnClearNativeLogs?.addEventListener('click', async () => {
        try {
            await invoke('clear_logs');
            await fetchLogs();
        } catch (error) {
            console.error('Unable to clear logs:', error);
        }
    });

    toggleLogs?.addEventListener('change', () => {
        if (toggleLogs?.checked) { 
            fetchLogs(); 
            logInterval = window.setInterval(fetchLogs, 1500) as unknown as number; 
        } else { 
            if (logInterval) { clearInterval(logInterval); logInterval = null; } 
        }
    });
  
    modalSearch?.addEventListener('input', () => {
        if(!modalSearch || !searchResults) return;
        const query = modalSearch.value.toLowerCase();
        const usedTags = Object.values(routingState).flat().map((t: any) => t.value);
        const filtered = allAvailableTags.filter(t => t.toLowerCase().includes(query) && !usedTags.includes(t));
        renderSearchResults(filtered); 
    });
  
    btnEditMode?.addEventListener('click', () => {
        isEditMode = !isEditMode; 
        selectedLinks.clear(); 
        selectedGroups.clear();
        if (editBar) editBar.style.display = isEditMode ? 'flex' : 'none';
        if (importBar) importBar.style.display = isEditMode ? 'none' : 'flex';
        renderLinks();
    });
  
    document.getElementById('btn-edit-cancel')?.addEventListener('click', () => {
        isEditMode = false; selectedLinks.clear(); selectedGroups.clear();
        if (editBar) editBar.style.display = 'none'; 
        if (importBar) importBar.style.display = 'flex';
        renderLinks();
    });
  
    document.getElementById('btn-edit-delete')?.addEventListener('click', () => {
        appLinks = appLinks.filter(l => !selectedLinks.has(l.id)); 
        cleanEmptyGroups();
        selectedLinks.clear(); selectedGroups.clear(); isEditMode = false;
        if (editBar) editBar.style.display = 'none'; 
        if (importBar) importBar.style.display = 'flex';
        saveData(); renderLinks();
    });
  
    document.getElementById('btn-edit-select-all')?.addEventListener('click', () => {
        const allSelected = selectedLinks.size === appLinks.length;
        if (allSelected) { 
            selectedLinks.clear(); selectedGroups.clear(); 
        } else { 
            appLinks.forEach(l => selectedLinks.add(l.id)); 
            appGroups.forEach(g => selectedGroups.add(g.id)); 
        }
        renderLinks();
    });
  
    document.getElementById('btn-edit-ungroup')?.addEventListener('click', () => {
        appLinks.forEach(l => { if (selectedLinks.has(l.id)) l.groupId = null; });
        cleanEmptyGroups(); selectedLinks.clear(); selectedGroups.clear();
        saveData(); renderLinks();
    });
  
    document.getElementById('btn-edit-rename')?.addEventListener('click', async () => {
        if (selectedGroups.size === 1) {
            const gId = Array.from(selectedGroups)[0]; 
            const g = appGroups.find(x => x.id === gId);
            if (!g) return;
            const newName = await showPrompt(t('prompt_rename_group'), g.name);
            if (newName) { g.name = newName; saveData(); renderLinks(); }
        } else { 
            alert(t('alert_select_one_group')); 
        }
    });
  
    document.getElementById('btn-edit-pin')?.addEventListener('click', () => {
        selectedGroups.forEach(gId => { const g = appGroups.find(x => x.id === gId); if (g) g.pinned = !g.pinned; });
        appLinks.forEach(l => { if (selectedLinks.has(l.id) && !l.groupId) l.pinned = !l.pinned; });
        saveData(); renderLinks();
    });
  
    document.getElementById('btn-edit-group')?.addEventListener('click', async () => {
        if (selectedLinks.size === 0) return;
        const gName = await showPrompt(t('prompt_new_group'), t('default_new_group'));
        if (gName) {
            const newGroupId = 'grp_' + Date.now();
            appGroups.push({ id: newGroupId, name: gName, pinned: false, isOpen: true });
            appLinks.forEach(l => { if (selectedLinks.has(l.id)) l.groupId = newGroupId; });
            
            selectedLinks.clear(); selectedGroups.clear(); isEditMode = false;
            if (editBar) editBar.style.display = 'none'; 
            if (importBar) importBar.style.display = 'flex';
            
            cleanEmptyGroups(); saveData(); renderLinks();
        }
    });
  
    const routeModal = document.getElementById('route-action-modal') as HTMLDialogElement | null;
    const fileInput = document.getElementById('route-file-input') as HTMLInputElement | null;
  
    document.getElementById('btn-route-action')?.addEventListener('click', () => { routeModal?.showModal(); });
    
    document.getElementById('btn-route-save')?.addEventListener('click', async () => {
        routeModal?.close();
        const name = await showPrompt(t('prompt_profile_name'));
        if (name && domType && domUrl && domIp && remType && remUrl && remIp) {
            routeProfiles.push({
                id: 'rp_' + Date.now(), name, defaultOutbound, rules: routingState,
                domDns: { type: domType.value, url: domUrl.value, ip: domIp.value },
                remDns: { type: remType.value, url: remUrl.value, ip: remIp.value },
                zonePriority: [...zonePriority] 
            });
            localStorage.setItem('karin_route_profiles', JSON.stringify(routeProfiles));
            renderRoutingProfiles();
        }
    });
  
    document.getElementById('btn-route-import')?.addEventListener('click', () => { routeModal?.close(); fileInput?.click(); });
  
    fileInput?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);
                    if (data.rules && data.domDns) {
                        data.id = 'rp_' + Date.now();
                        routeProfiles.push(data);
                        localStorage.setItem('karin_route_profiles', JSON.stringify(routeProfiles));
                        renderRoutingProfiles();
                    }
                } catch(err) { alert(t('err_parse_file')); }
            };
            reader.readAsText(file);
        }
    });
    checkApplicationUpdates();
}

// **********************************
// GLOBAL EVENT DELEGATION
// **********************************
document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
  
    const col = target.closest('.route-column');
    if (col && !target.closest('.btn-add') && !target.closest('.btn-delete-tag') && !target.closest('.tag-item')) {
      defaultOutbound = (col as HTMLElement).dataset.zone as ZoneKey;
      localStorage.setItem('karin_default_outbound', defaultOutbound); 
      updateDefaultOutboundUI();
    }
  
    const isMenuDot = target.closest('.btn-menu-dots');
    const isDropdown = target.closest('.dropdown-menu');
    const isCustomSelect = target.closest('.custom-select-btn'); 
    
    if (!isMenuDot && !isDropdown && !isCustomSelect) { 
        document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none'); 
    }
  
    if (target.id === 'btn-ping' || target.closest('#btn-ping')) {
      if(btnPing) btnPing.innerText = "...";
      invoke<string>('check_ping').then(res => { if(btnPing) btnPing.innerText = res; }).catch(() => { if(btnPing) btnPing.innerText = "Error"; });
    }
  
    if (target.classList.contains('btn-add')) { 
        currentZone = target.dataset.zone as ZoneKey; 
        searchModal?.showModal(); 
        modalSearch?.focus(); 
    }
    
    if (target.classList.contains('btn-delete-tag')) {
      const tag = target.dataset.tag!; const zone = target.dataset.zone as ZoneKey;
      routingState[zone] = routingState[zone].filter((t: any) => t.value !== tag); renderRouting();
    }
  
    const selectableItem = target.closest('.link-item[data-select-url]') as HTMLElement | null;
    if (selectableItem && !isEditMode && !target.closest('.link-actions')) {
        const url = selectableItem.dataset.selectUrl!;
        selectedProfileUrl = url;
        localStorage.setItem('karin_selected_profile', url);
        renderLinks();
        updateHeroProfileName();
        profilesDrawer?.close();
    }
  
    if (target.classList.contains('edit-checkbox') && !target.hasAttribute('data-group-id')) {
        const id = target.dataset.id!;
        if ((target as HTMLInputElement).checked) selectedLinks.add(id); else selectedLinks.delete(id);
    }
  
    const groupHeader = target.closest('.group-header');
    if (groupHeader && !target.closest('.edit-checkbox')) {
        const gId = (groupHeader as HTMLElement).dataset.id!;
        const group = appGroups.find(g => g.id === gId);
        if (group) { group.isOpen = !group.isOpen; saveData(); renderLinks(); }
    }
  
    if (isMenuDot) {
      const btn = isMenuDot as HTMLElement; 
      const index = btn.dataset.index;
      const isRoute = btn.classList.contains('btn-route-menu-dots');
      const menuId = isRoute ? `route-menu-${index}` : `menu-${index}`;
      const menu = document.getElementById(menuId);
      const isCurrentlyOpen = menu?.style.display === 'flex';
      
      document.querySelectorAll('.dropdown-menu').forEach(m => (m as HTMLElement).style.display = 'none');
      
      if (menu && !isCurrentlyOpen) {
        menu.style.display = 'flex'; menu.style.top = '100%'; menu.style.bottom = 'auto'; menu.style.marginTop = '8px'; menu.style.marginBottom = '0';
        const container = isRoute ? document.getElementById('routing-profiles-list') : linksContainer;
        if (container) {
            const menuRect = menu.getBoundingClientRect(); const containerRect = container.getBoundingClientRect();
            if (menuRect.bottom > containerRect.bottom) { menu.style.top = 'auto'; menu.style.bottom = '100%'; menu.style.marginTop = '0'; menu.style.marginBottom = '8px'; }
        }
      } else if (menu && isCurrentlyOpen) {
          menu.style.display = 'none';
      }
    }
  
    if (target.classList.contains('btn-share') && !target.closest('.btn-export-profile')) {
      navigator.clipboard.writeText(target.dataset.url!).then(() => {
        const originalText = target.innerText; target.innerText = t('btn_copied') || 'Скопировано!';
        setTimeout(() => { target.innerText = originalText; const menu = target.closest('.dropdown-menu') as HTMLElement; if (menu) menu.style.display = 'none'; }, 1000);
      }).catch(() => alert('Copy Error'));
    }
  
    if (target.classList.contains('btn-pin') && !target.closest('#edit-bar')) {
        const id = target.dataset.id;
        const link = appLinks.find(l => l.id === id);
        if (link) { link.pinned = !link.pinned; saveData(); renderLinks(); }
        const menu = target.closest('.dropdown-menu') as HTMLElement; if (menu) menu.style.display = 'none';
    }
  
    if (target.classList.contains('btn-delete-link')) {
        const id = target.dataset.id;
        appLinks = appLinks.filter(l => l.id !== id);
        cleanEmptyGroups(); saveData(); renderLinks();
    }
    
    const loadBtn = target.closest('.btn-load-profile') as HTMLElement;
    if (loadBtn) {
        try {
            const p = routeProfiles.find(x => x.id === loadBtn.dataset.id);
            if (p && domType && domUrl && domIp && remType && remUrl && remIp) {
                if (p.rules) routingState = JSON.parse(JSON.stringify(p.rules)); 
                if (p.defaultOutbound) defaultOutbound = p.defaultOutbound as ZoneKey;
                
                if (p.zonePriority) {
                    zonePriority = [...p.zonePriority];
                    localStorage.setItem('karin_zone_priority', JSON.stringify(zonePriority));
                    applyColumnOrder();
                }
                
                domType.value = p.domDns?.type || 'doh'; 
                domUrl.value = p.domDns?.url || ''; 
                domIp.value = p.domDns?.ip || '';
                
                remType.value = p.remDns?.type || 'doh'; 
                remUrl.value = p.remDns?.url || ''; 
                remIp.value = p.remDns?.ip || '';
                
                saveDnsState(); 
                localStorage.setItem('karin_default_outbound', defaultOutbound); 
                localStorage.setItem('karin_routing', JSON.stringify(routingState));
                updateDefaultOutboundUI(); 
                renderRouting();
                
                const orig = loadBtn.innerText;
                loadBtn.innerText = t('status_applied');
                setTimeout(() => { loadBtn.innerText = orig; }, 1500);
            }
        } catch (err) {
            console.error(err); alert(t('err_apply_profile'));
        }
    }
  
    const delBtn = target.closest('.btn-del-profile') as HTMLElement;
    if (delBtn) {
        routeProfiles = routeProfiles.filter(x => x.id !== delBtn.dataset.id);
        localStorage.setItem('karin_route_profiles', JSON.stringify(routeProfiles)); 
        renderRoutingProfiles();
    }
  
    const editBtn = target.closest('.btn-edit-profile') as HTMLElement;
    if (editBtn) {
        const p = routeProfiles.find(x => x.id === editBtn.dataset.id);
        if (p) {
            const newName = await showPrompt(t('prompt_new_name'), p.name);
            if (newName) { 
                p.name = newName; 
                localStorage.setItem('karin_route_profiles', JSON.stringify(routeProfiles)); 
                renderRoutingProfiles(); 
            }
        }
        const menu = target.closest('.dropdown-menu') as HTMLElement; if (menu) menu.style.display = 'none';
    }
  
    const exportBtn = target.closest('.btn-export-profile') as HTMLElement;
    if (exportBtn) {
        const p = routeProfiles.find(x => x.id === exportBtn.dataset.id);
        if (p) {
            const jsonStr = JSON.stringify(p, null, 2);
            invoke('export_profile', { 
                filename: `routing_${p.name}.json`, 
                content: jsonStr 
            }).then((res) => {
                console.log(res);
            }).catch((err) => {
                if (err !== "Отменено") alert(`${t('err_export')} ${err}`);
            });
        }
        const menu = target.closest('.dropdown-menu') as HTMLElement; if (menu) menu.style.display = 'none';
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void init(); });
} else {
    void init();
}