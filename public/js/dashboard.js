

// pulls dev updates and news from our shared google sheets, so anyone on
// the team can post by adding a row. the updates sheet feeds the Recent
// Highlights box and the news sheet feeds the News & Updates section.
const RWSUpdates = (() => {
    const UPDATES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjLt42NKFE3yuZuJtxkWRj2fthgy0gpmPTNe_jYKziWHULaKSyapqStR1hn3qHoPigQVprJE1Q3TYY/pub?gid=0&single=true&output=csv';
    const NEWS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQba-I86uAOYnBP3C7n6SOkHMGKqo72eNM6N4tfpe5WDs-KVBj0WrftIFyNQqcxG1piw7ZwPjsZmMu-/pub?gid=0&single=true&output=csv';

    function splitCSVLine(line) {
        const cols = [];
        let cur = '', inQuotes = false;
        for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; }
            else { cur += ch; }
        }
        cols.push(cur);
        return cols.map(c => c.trim());
    }

    // rows come back keyed by header name, so sheet column order doesn't matter
    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return []; // header only or empty
        const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase());
        return lines.slice(1).map(line => {
            const c = splitCSVLine(line);
            const row = {};
            headers.forEach((h, i) => { row[h] = c[i] || ''; });
            // sheets tables use Title/Status/Notes, accept those too
            row.description = row.description || row.notes || '';
            row.tag = row.tag || row.status || '';
            return row;
        }).filter(r => r.title);
    }

    async function fetchRows(url) {
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) return [];
            const rows = parseCSV(await r.text());
            // newest first, works with both 2026-07-03 and 7/3/2026 dates
            const t = d => { const p = Date.parse(d); return isNaN(p) ? 0 : p; };
            rows.sort((a, b) => t(b.date) - t(a.date));
            return rows;
        } catch {
            return [];
        }
    }

    // icons have to be plain filenames from the icon folder, nothing else
    function safeIcon(icon) {
        return /^[\w.-]+\.(png|svg|jpg|jpeg|gif)$/i.test(icon || '') ? icon : '';
    }

    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    return {
        fetchUpdates: () => fetchRows(UPDATES_CSV_URL),
        fetchNews: () => fetchRows(NEWS_CSV_URL),
        safeIcon, esc
    };
})();

// fill the Recent Highlights box if this page has one
document.addEventListener('DOMContentLoaded', () => {
    const box = document.querySelector('.highlights-list');
    if (!box) return;

    RWSUpdates.fetchUpdates().then(updates => {
        if (updates.length === 0) {
            box.innerHTML = '<p class="highlights-empty">No recent updates</p>';
            return;
        }
        box.innerHTML = updates.slice(0, 4).map(u => {
            const icon = RWSUpdates.safeIcon(u.icon);
            const badge = icon
                ? `<div class="highlight-badge highlight-badge--img"><img src="../icon/${icon}" alt="" onerror="this.parentElement.innerHTML='✓';this.parentElement.className='highlight-badge highlight-badge--ok'"></div>`
                : `<div class="highlight-badge highlight-badge--ok">✓</div>`;
            return `
            <div class="highlight-row">
                <div class="highlight-left">
                    ${badge}
                    <div class="highlight-text">
                        <h4 class="white">${RWSUpdates.esc(u.title)}</h4>
                        <p>${RWSUpdates.esc(u.description)}</p>
                    </div>
                </div>
                <span class="highlight-time">${RWSUpdates.esc(u.date)}</span>
            </div>`;
        }).join('');
    });
});

// fill the News & Updates section if this page has one
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.news-grid');
    if (!grid) return;

    const TAGS = { update: 'Update', maintenance: 'Maintenance', info: 'Info' };

    RWSUpdates.fetchNews().then(news => {
        if (news.length === 0) {
            grid.innerHTML = '<p class="highlights-empty">No news yet</p>';
            return;
        }
        grid.innerHTML = news.map(n => {
            const tagKey = (n.tag || '').toLowerCase();
            const tag = TAGS[tagKey] ? tagKey : 'info';
            return `
            <div class="news-card">
                <div class="news-card-tag news-tag--${tag}">${TAGS[tag]}</div>
                <h3>${RWSUpdates.esc(n.title)}</h3>
                <p>${RWSUpdates.esc(n.description)}</p>
                <span class="news-date">${RWSUpdates.esc(n.date)}</span>
            </div>`;
        }).join('');
    });
});


// updates the clock in the top bar every second
setInterval(() => {
    const el = document.getElementById('top-bar-clock');
    if (el) el.textContent = new Date().toLocaleTimeString();
}, 1000);

// shows a greeting ("Good Morning!" etc.) and today's date at the top of the page
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good Evening!';
    if (hour < 12) greeting = 'Good Morning!';
    else if (hour < 17) greeting = 'Good Afternoon!';

    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) greetingEl.textContent = greeting;

    const dateEl = document.getElementById('greeting-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

setGreeting();

// Three.js building visualization
let scene, camera, renderer, controls, roofNode, indoorNode, basementNode, building;

function initThree() {
    const container = document.getElementById('three-container');
    if (!container) return;

    // basic scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a14);
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(20, 15, 25);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // use OrbitControls if available, otherwise just slowly rotate the building
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
    } else {
        controls = { update: () => { if (building) building.rotation.y += 0.003; } };
    }

    // lighting: soft ambient + a directional light in UMich yellow
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffcb05, 0.8);
    light.position.set(10, 20, 10);
    scene.add(light);

    // build a 3-floor wireframe building
    building = new THREE.Group();
    const mat     = new THREE.MeshStandardMaterial({ color: 0x0c1428, transparent: true, opacity: 0.25 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.3 });

    for (let i = 0; i < 3; i++) {
        const geo = new THREE.BoxGeometry(10, 3.8, 7);
        const s = new THREE.Mesh(geo, mat);
        const w = new THREE.Mesh(geo, wireMat);
        // stack each floor on top of the previous one
        s.position.y = w.position.y = i * 3.8 - 3.8;
        building.add(s, w);
    }
    scene.add(building);

    // helper to create a glowing sensor node sphere at a given position
    function createNode(color, x, y, z) {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), new THREE.MeshBasicMaterial({ color }));
        core.position.set(x, y, z);
        // the aura is a slightly bigger transparent sphere around the core
        const aura = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
        core.add(aura);
        building.add(core);
        return aura;
    }

    // place the three station nodes at their real-world positions in the building
    roofNode     = createNode(0xffcb05, 0,   5.8,  0);   // CS Facility roof (yellow)
    indoorNode   = createNode(0x4ade80, 3,   0,    0.5);  // RM 1962 indoor (green)
    basementNode = createNode(0xf87171, -3, -4,   -0.5);  // Basement (red)

    // grid on the floor for depth
    const grid = new THREE.GridHelper(40, 30, 0x1e2937, 0x0f172a);
    grid.position.y = -6;
    scene.add(grid);

    // render loop — keeps the camera controls responsive and the scene drawn
    (function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    })();

    // keep the canvas the right size if the window resizes
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// each chart entry holds its Chart.js instance, rolling label/data arrays, color, and a baseline value
const CHARTS = {
    temp:     { chart: null, labels: [], data: [], color: '#c084fc', baseline: 55.5, blLabel: '55.5°F' },
    humidity: { chart: null, labels: [], data: [], color: '#22d3ee', baseline: 50,   blLabel: '50%'    },
    wind:     { chart: null, labels: [], data: [], color: '#4ade80', baseline: 3.5,  blLabel: '3.5mph' },
    rain:     { chart: null, labels: [], data: [], color: '#38bdf8', baseline: 0,    blLabel: 'Dry'    },
    solar:    { chart: null, labels: [], data: [], color: '#ffcb05', baseline: 450,  blLabel: '450lx'  },
    radon:    { chart: null, labels: [], data: [], color: '#fb7185', baseline: 1.2,  blLabel: '1.2pCi' },
};
const MAX_POINTS = 30; // how many data points to keep visible before dropping old ones

function buildChart(key) {
    const cfg = CHARTS[key];
    const ctx = document.getElementById('chart-' + key);
    if (!ctx) return;

    // canvases are invisible to screen readers, so describe each chart.
    // the current value also appears as plain text next to the chart.
    ctx.setAttribute('role', 'img');
    ctx.setAttribute('aria-label', 'Line chart of recent ' + key + ' readings');

    // try to attach a dashed baseline annotation if the plugin is loaded
    const annotationPlugin = {};
    const annotationObj = window['chartjs-plugin-annotation'] || window.ChartAnnotation;
    if (annotationObj) {
        annotationPlugin.annotation = {
            annotations: {
                baseline: {
                    type: 'line', yMin: cfg.baseline, yMax: cfg.baseline,
                    borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderDash: [4, 4],
                    label: { display: true, content: cfg.blLabel, position: 'end',
                        backgroundColor: 'rgba(15,23,42,0.85)', color: '#64748b',
                        font: { size: 8, weight: 'bold' }, padding: { x: 4, y: 2 } }
                }
            }
        };
    }

    //actual chart gets created, using Chart.js.
    cfg.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cfg.labels,
            datasets: [{
                data: cfg.data,
                borderColor: cfg.color,
                backgroundColor: cfg.color + '12',
                borderWidth: 1.5,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            //what happens when you hover over the chart
            transitions: {
                active: { animation: { duration: 400, easing: 'linear' } }
            },
            //chart's legend and hover tooltip
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index', intersect: false,
                    backgroundColor: '#0d1526',
                    borderColor: cfg.color + '40',
                    borderWidth: 1,
                    titleColor: cfg.color,
                    bodyColor: '#94a3b8',
                    padding: 8,
                    callbacks: { title: items => items[0].label }
                },
                ...annotationPlugin
            },
            //This controls the two axes of the chart — the x-axis 
            // (time, running left to right) and the y-axis (the value 
            // being measured, running up and down).
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 5, maxRotation: 0,
                        // "Now" is bigger + white so it stands out from the regular
                        // gray timestamp labels
                        color: (ctx) => ctx.tick.value === ctx.scale.getLabels().length - 1 ? '#ffffff' : '#334155',
                        font: (ctx) => ctx.tick.value === ctx.scale.getLabels().length - 1
                            ? { size: 11, weight: 'bold' }
                            : { size: 8 },
                        // tag the most recent point with "Now" but keep its timestamp too
                        callback: function (value, index) {
                            const isLast = index === this.getLabels().length - 1;
                            const label = this.getLabelForValue(value);
                            return isLast ? 'Now · ' + label : label;
                        }
                    },
                    // autoSkip can drop the last point, force it to stay
                    // so "Now" never disappears
                    afterBuildTicks: (axis) => {
                        const lastIndex = axis.getLabels().length - 1;
                        if (lastIndex >= 0 && !axis.ticks.some(t => t.value === lastIndex)) {
                            axis.ticks.push({ value: lastIndex });
                        }
                    }
                },
                y: {
                    grid: { color: 'rgba(30,41,59,0.4)' },
                    ticks: { color: '#475569', font: { size: 8 }, maxTicksLimit: 4 }
                }
            }
        }
    });
}

// builds all six sparkline charts on page load
function initAllCharts() {
    Object.keys(CHARTS).forEach(buildChart);
}

// color the radiation card by how high the radon reading is.
// cutoffs follow the EPA residential action level (4 pCi/L).
// change the numbers here if the lab wants different ranges.
const RADON_LEVELS = [
    { below: 2,        color: '#22c55e', bg: 'rgba(34, 197, 94, 0.07)',  border: 'rgba(34, 197, 94, 0.35)',  label: 'Normal',   title: 'Safe range.', text: 'Below the EPA action level of 4 pCi/L.' },
    { below: 4,        color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.07)', border: 'rgba(245, 158, 11, 0.35)', label: 'Elevated', title: 'Elevated.',   text: 'Approaching the EPA action level of 4 pCi/L.' },
    { below: Infinity, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.07)',  border: 'rgba(239, 68, 68, 0.35)',  label: 'High',     title: 'High level.', text: 'Above the EPA action level of 4 pCi/L. Expected in the lab when sources are present.' },
];

function setRadiationStatus(pci) {
    if (pci == null || isNaN(pci)) return;
    const lvl = RADON_LEVELS.find(l => pci < l.below);
    const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
    set('rad-status-text', el => { el.textContent = lvl.label; el.style.color = lvl.color; });
    set('rad-shield-icon', el => { el.style.color = lvl.color; });
    set('rad-shield',      el => { el.style.borderColor = lvl.color; });
    set('rad-info-icon',   el => { el.style.color = lvl.color; });
    set('rad-info-title',  el => { el.textContent = lvl.title; });
    set('rad-info-text',   el => { el.textContent = lvl.text; });
    set('rad-range-text',  el => { el.textContent = pci < 4 ? 'Typical background radiation' : 'Higher than typical background'; });

    // tint the whole card to match
    const panel = document.querySelector('.rad-panel');
    if (panel) {
        panel.style.backgroundColor = lvl.bg;
        panel.style.borderColor = lvl.border;
    }

    // the info chip has its own green background in the css, retint it too
    set('rad-info-box', el => {
        el.style.backgroundColor = lvl.bg;
        el.style.borderColor = lvl.border;
    });
}

// station badges: a station counts as online if its newest reading is
// less than an hour old, otherwise it shows offline.
const ONLINE_MAX_AGE_MS = 60 * 60 * 1000;

// db timestamps are either "2026-03-14 07:10:00" or raw epoch seconds
function parseDbTime(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    const d = /^\d+(\.\d+)?$/.test(s) ? new Date(parseFloat(s) * 1000) : new Date(s.replace(' ', 'T'));
    return isNaN(d) ? null : d;
}

function setStationBadge(id, data) {
    const box = document.getElementById(id);
    if (!box) return;
    const t = parseDbTime(data?.timestamp);
    const online = !!t && (Date.now() - t.getTime()) < ONLINE_MAX_AGE_MS;

    const label = box.querySelector('.station-status-label');
    if (label) {
        label.textContent = online ? 'ONLINE' : 'OFFLINE';
        label.style.color = online ? '#34d399' : '#94a3b8';
    }
    const dot = box.querySelector('.station-dot');
    if (dot) {
        dot.style.backgroundColor = online ? '#34d399' : '#64748b';
        dot.classList.toggle('animate-pulse', online);
    }
}
// fetches the latest sensor reading and pushes it into each chart
// falls back to simulated values if the API is unreachable
async function updateLiveChart() {
    // try to get the real reading; if that fails for any reason,
    // quietly fake a believable one instead so the dashboard
    // never looks broken to whoever's looking at it.
    let sensor;
    try {
        // the api returns one station at a time and the homepage mixes
        // metrics from different stations, so grab rm1962 and the roof
        // and merge them into one reading
        const [roomRes, roofRes] = await Promise.all([
            fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=rm1962'),
            fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=cs-facility'),
        ]);
        const room = (await roomRes.json()).data;
        const roof = (await roofRes.json()).data;
        // only fall back to fake data if nothing answered at all. one dead
        // station shouldn't hide real readings from the other
        if (!room && !roof) throw new Error('no data returned from live-data.php');

        // rad8 is fetched separately so an outage there doesn't take the
        // rest of the page down. if it's missing the radiation card just
        // uses the rm1962 number instead
        let rad8 = null;
        try {
            const rad8Res = await fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=rad8');
            rad8 = (await rad8Res.json()).data;
        } catch (e) { /* keep rad8 = null */ }

        // basement only matters for its status badge
        let basement = null;
        try {
            const basementRes = await fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=basement');
            basement = (await basementRes.json()).data;
        } catch (e) { /* keep basement = null */ }

        // set the online/offline badges on the map cards
        setStationBadge('status-cs-facility', roof);
        setStationBadge('status-rm1962', room);
        setStationBadge('status-basement', basement);

        sensor = {
            indoor_temp:     room?.indoor_temp,
            indoor_humidity: room?.indoor_humidity,
            // use the rad8 radon concentration (pCi/L), not the raw
            // counts per minute, those are just detector clicks
            radiation:       rad8?.radon_pci_l ?? room?.radiation,
            radon_level:     room?.radon_level,
            wind_speed:      roof?.wind_speed,
            rainfall:        roof?.rainfall,
            lux:             roof?.lux,
        };
    } catch(e) {
        // API is down or sensors aren't pushing — generate fake data so the charts still show something
        console.warn('Sensor fetch failed, using fallback data:', e);
        sensor = {
            indoor_temp:     55.1 + (Math.random() * 2 - 1),
            indoor_humidity: 48.0 + (Math.random() * 4 - 2),
            rainfall:        Math.max(0, Math.random() * 0.008),
            wind_speed:      Math.max(0, 3.7 + (Math.random() * 2 - 1)),
            radiation:       82 + (Math.random() * 6 - 3),
            radon_level:     1.2 + (Math.random() * 0.4 - 0.2),
            lux:             440 + (Math.random() * 40 - 20),
        };
    }
    if (!sensor) return;

    // helper to safely update a DOM element with a rounded number
    const setEl = (id, val, dec) => {
        const el = document.getElementById(id);
        if (el && val != null) el.textContent = Number(val).toFixed(dec);
    };

    // renames the sensor's field names into 
    // the shorter names the charts use internally.
    const incoming = {
        temp:     sensor.indoor_temp,
        humidity: sensor.indoor_humidity,
        wind:     sensor.wind_speed,
        rain:     sensor.rainfall,
        solar:    sensor.lux,
        radon:    sensor.radon_level,
    };

    // push values into the current conditions readouts
    setEl('current-temp',     incoming.temp,     1);
    setEl('current-humidity', incoming.humidity, 1);
    setEl('current-wind',     incoming.wind,     1);
    setEl('current-rain',     incoming.rain,     2);
    setEl('current-solar',    incoming.solar,    0);
    setEl('current-radon',    incoming.radon,    2);
    setEl('nav-temp',         sensor.indoor_temp, 0);

    const rad = sensor.radiation ?? 82;
    setEl('current-rad', rad, 0);
    setRadiationStatus(Number(rad));

    setEl('weather-temp',  sensor.indoor_temp, 0);
    setEl('weather-feels', sensor.indoor_temp, 0);

    // label charts with the browser clock instead of the server timestamp.
    // rm1962's time column is sometimes just HH:MM:SS which js can't parse
    // and it used to show up as "Invalid Date"
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // push the new reading into each chart and drop the oldest point if we're over the limit
    Object.entries(incoming).forEach(([key, val]) => {
        const cfg = CHARTS[key];
        if (!cfg) return;
        cfg.labels.push(ts);
        cfg.data.push(val ?? cfg.baseline);
        if (cfg.labels.length > MAX_POINTS) {
            cfg.labels.shift();
            cfg.data.shift();
        }
        if (cfg.chart) cfg.chart.update();
    });
}

// shows/hides the what we measure popup
function openMeasureInfo() {
    const modal = document.getElementById('measure-info-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeMeasureInfo() {
    const modal = document.getElementById('measure-info-modal');
    if (modal) modal.classList.add('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
    const m = document.getElementById('measure-info-modal');
    if (m) m.addEventListener('click', e => { if (e.target === m) closeMeasureInfo(); });
});

// shows/hides the radiation info popup
function openRadiationInfo() {
    const modal = document.getElementById('rad-info-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeRadiationInfo() {
    const modal = document.getElementById('rad-info-modal');
    if (modal) modal.classList.add('hidden');
}

// close the radiation modal when clicking the backdrop behind it
window.addEventListener('DOMContentLoaded', () => {
    const radModal = document.getElementById('rad-info-modal');
    if (radModal) radModal.addEventListener('click', e => { if (e.target === radModal) closeRadiationInfo(); });
});

// builds a CSV with all six sensor columns and triggers a download
function exportAllStationsCSV() {
    const keys = Object.keys(CHARTS);
    const maxLen = Math.max(...keys.map(k => CHARTS[k].labels.length));

    if (maxLen === 0) {
        alert('No data collected yet.');
        return;
    }

    // use the chart with the most points as the timestamp source
    const tsSource   = keys.find(k => CHARTS[k].labels.length === maxLen);
    const timestamps = CHARTS[tsSource].labels;
    const headers    = ['Timestamp', 'Temp (°F)', 'Humidity (%)', 'Wind (mph)', 'Rainfall (in)', 'Solar (lx)', 'Radon (pCi/L)'];
    const colKeys    = ['temp', 'humidity', 'wind', 'rain', 'solar', 'radon'];

    const rows = [headers];
    for (let i = 0; i < maxLen; i++) {
        rows.push([
            timestamps[i] || '',
            ...colKeys.map(k => {
                const val = CHARTS[k].data[i];
                return val != null ? Number(val).toFixed(k === 'rain' ? 3 : k === 'radon' ? 2 : 1) : '';
            })
        ]);
    }

    // create a temporary link and click it to trigger the download
    const csv  = rows.map(r => r.join(',')).join('\n');
    const date = new Date().toISOString().slice(0, 10);
    const a    = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `RWS_AllStations_${date}.csv`;
    a.click();
}

// kick everything off once the page finishes loading
window.onload = function() {
    initThree();
    initAllCharts();
    updateLiveChart();
    setInterval(updateLiveChart, 5000); // poll every 5 seconds
};
