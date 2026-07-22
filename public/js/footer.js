// loads footer.html and drops it into the page
// (path is relative to the page, not this file, so it'll break if a page lives in a subfolder)
async function loadFooter() {
    const el = document.getElementById('footer-placeholder');
    if (!el) return;
    try {
        const response = await fetch('footer.html');
        if (!response.ok) throw new Error('footer.html not found or failed to load');
        el.innerHTML = await response.text();
    } catch (error) {
        console.error('footer failed to load:', error);
    }
}
loadFooter();


// hamburger menu for phones. the button and the dark backdrop don't exist
// in the html -- we build them here so the pages don't need editing.
// all the actual open/close styling lives in styles.css under body.nav-open
function setupMobileNav() {
    const sidebar = document.querySelector('.sidebar, .app-sidebar');
    const header = document.querySelector('.global-header');
    if (!sidebar || !header) return;

    const btn = document.createElement('button');
    btn.className = 'mobile-nav-toggle';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    header.insertBefore(btn, header.firstChild);

    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-nav-backdrop';
    document.body.appendChild(backdrop);

    btn.addEventListener('click', () => document.body.classList.toggle('nav-open'));

    // tapping the dark area or any menu link should close the drawer
    const closeMenu = () => document.body.classList.remove('nav-open');
    backdrop.addEventListener('click', closeMenu);
    sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileNav);
} else {
    setupMobileNav();
}


// swap the little station icons in the sidebar depending on whether the
// station has reported recently. uses the same 1 hour rule as the badges
// on the homepage so the two never disagree.
function updateSidebarStationIcons() {
    const HOUR = 60 * 60 * 1000;
    const stations = {
        'cs-facility.html': 'cs-facility',
        'basement.html': 'basement',
        'rm1962.html': 'rm1962',
    };

    // db timestamps are inconsistent: some tables store "2026-03-14 07:10:00",
    // rm1962 stores raw epoch seconds. handle both.
    function parseTimestamp(raw) {
        if (raw == null) return null;
        const s = String(raw).trim();
        const d = /^\d+(\.\d+)?$/.test(s)
            ? new Date(parseFloat(s) * 1000)
            : new Date(s.replace(' ', 'T'));
        return isNaN(d) ? null : d;
    }

    document.querySelectorAll('.sidebar-submenu a').forEach(async link => {
        const station = stations[link.getAttribute('href')];
        const img = link.querySelector('.sidebar-station-icon');
        if (!station || !img) return;

        let online = false;
        try {
            const res = await fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=' + station);
            const last = parseTimestamp((await res.json()).data?.timestamp);
            online = last !== null && Date.now() - last.getTime() < HOUR;
        } catch (e) {
            // can't reach the api, so offline it is
        }

        img.src = online ? '../icon/online.png' : '../icon/not_online.png';
        img.alt = online ? 'Online' : 'Offline';
    });
}

document.addEventListener('DOMContentLoaded', updateSidebarStationIcons);
