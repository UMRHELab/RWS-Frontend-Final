// Shared navigation utilities
// Controls sidebar station menu, footer loading, mobile navigation,
// and station connection indicators.
// Read a CSS custom property value (colors live in styles/*.css)
function cssVar(name) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
}
// Toggle the radiation station submenu in the sidebar
function toggleRadiationsMenu() {
    const submenu = document.getElementById('radiations-submenu');
    const chevron = document.getElementById('radiation-chevron');
    if (submenu) submenu.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('collapsed');
}
window.toggleRadiationsMenu = toggleRadiationsMenu;
// Load shared footer content
// Footer path is relative to the current HTML page location.
async function loadFooter() {
    const el = document.getElementById('footer-placeholder');
    if (!el) return;
    try {
        const response = await fetch('footer.html');
        if (!response.ok) {
            throw new Error('footer.html failed to load');
        }
        el.innerHTML = await response.text();
    } catch (error) {
        console.error('Unable to load footer:', error);
    }
}
loadFooter();
// Initialize mobile sidebar navigation
// Creates the menu button and overlay dynamically so individual pages
// do not need additional HTML changes.
function setupMobileNav() {
    const sidebar = document.querySelector('.sidebar, .app-sidebar');
    const header = document.querySelector('.global-header');
    if (!sidebar || !header) return;
    // Create mobile menu toggle button
    const btn = document.createElement('button');
    btn.className = 'mobile-nav-toggle';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    header.insertBefore(
        btn,
        header.firstChild
    );
    // Create background overlay used when menu is open
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-nav-backdrop';
    document.body.appendChild(backdrop);
    // Toggle sidebar visibility
    btn.addEventListener('click', () => {
        document.body.classList.toggle('nav-open');
    });
    // Close menu after selecting a link or clicking outside
    const closeMenu = () => {
        document.body.classList.remove('nav-open');
    };
    backdrop.addEventListener(
        'click',
        closeMenu
    );
    sidebar
        .querySelectorAll('a')
        .forEach(link => {
            link.addEventListener(
                'click',
                closeMenu
            );
        });
}
if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        setupMobileNav
    );
} else {
    setupMobileNav();
}
// Update sidebar station icons based on latest station status
// Uses the same one-hour timeout rule as homepage status indicators.
function updateSidebarStationIcons() {
    const ONLINE_TIMEOUT = 60 * 60 * 1000;
    const stations = {
        'station.html?station=cs-facility': 'cs-facility',
        'station.html?station=basement': 'basement',
        'station.html?station=rm1962': 'rm1962',
    };
    // Convert database timestamps into Date objects
    // Supports SQL datetime strings and Unix epoch timestamps.
    function parseTimestamp(raw) {
        if (raw == null) return null;
        const s = String(raw).trim();
        const d = /^\d+(\.\d+)?$/.test(s)
            ? new Date(parseFloat(s) * 1000)
            : new Date(s.replace(' ', 'T'));
        return isNaN(d) ? null : d;
    }
    document
        .querySelectorAll('.sidebar-submenu a')
        .forEach(async link => {
            const station =
                stations[link.getAttribute('href')];
            const img =
                link.querySelector('.sidebar-station-icon');
            if (!station || !img) return;
            let online = false;
            try {
                const response = await fetch(
                    'https://dev-engin-rws.pantheonsite.io/live-data.php?station=' + station
                );
                const timestamp =
                    parseTimestamp(
                        (await response.json()).data?.timestamp
                    );
                online =
                    timestamp !== null &&
                    Date.now() - timestamp.getTime() < ONLINE_TIMEOUT;
            } catch {
                // Keep station marked offline if data cannot be reached
            }
            img.src = online
                ? '../icon/online.png'
                : '../icon/not_online.png';
            img.alt = online
                ? 'Online'
                : 'Offline';
        });
}
document.addEventListener(
    'DOMContentLoaded',
    updateSidebarStationIcons
);
