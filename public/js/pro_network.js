// Pro Network page. Data comes from pro-data.php,
// which reads straight out of the Pro tables in webapps2's rws_data database
// (AirTemp, EnclosureTemp, DoseRate, WindSpeed, SolarRad, Rain, RainRunningTotal,
// BarometricPressure). Doesn't matter if the old Pro site is up or not, this
// hits the same database Lite's live-data.php already talks to.

function toggleRadiationsMenu() {
    const submenu = document.getElementById('radiations-submenu');
    const chevron = document.getElementById('radiation-chevron');
    if (submenu) submenu.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('collapsed');
}

function initClockAndDates() {
    setInterval(() => {
        const el = document.getElementById('top-bar-clock');
        if (el) el.textContent = new Date().toLocaleTimeString();
    }, 1000);

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const de = document.getElementById('greeting-date');
    if (de) de.textContent = dateStr;
}

// small helper so we're not writing the same getElementById/textContent
// check everywhere
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// Builds a Chart.js line chart with the same look for every panel on this
// page, so we're not repeating this whole config block 6 times.
function buildLineChart(canvasId, datasets, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    ctx.setAttribute('role', 'img');
    ctx.setAttribute('aria-label', opts.ariaLabel || ('Line chart for ' + canvasId));

    return new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: datasets.length > 1, labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } } } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6, maxRotation: 0, color: '#64748b', font: { size: 9 } },
                },
                y: {
                    type: opts.logarithmic ? 'logarithmic' : 'linear',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: opts.yTitle ? { display: true, text: opts.yTitle, color: '#64748b' } : undefined,
                    ticks: {
                        color: '#64748b',
                        font: { size: 9 },
                        callback: opts.tickCallback || undefined,
                    },
                },
            },
        },
    });
}

// One line series for a chart. Just fills in the boring defaults (line
// width, no dots, slight curve) so each panel below only has to pass a color.
function lineDataset(color, extra = {}) {
    return {
        data: [],
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.08)').replace('rgb(', 'rgba('),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        fill: extra.fill !== false,
        ...extra,
    };
}

// pro-data.php sends back rows as {x, y}, but y comes through as a string
// since that's how MySQL hands back decimals through PDO. This turns it into
// an actual number and drops anything broken/missing so a bad row doesn't
// blow up the whole chart.
function cleanSeries(rows) {
    return (rows || [])
        .filter(r => r && r.x && r.y != null)
        .map(r => ({ x: r.x, y: Number(r.y) }))
        .filter(r => Number.isFinite(r.y));
}

// grabs one table's worth of readings, e.g. fetchTable('SolarRad').
// path is root-relative (/pro-data.php) so it works no matter what folder
// this page happens to be served from
async function fetchTable(table) {
    const res = await fetch(`/pro-data.php?table=${encodeURIComponent(table)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('bad response');
    const json = await res.json();
    return cleanSeries(json.data);
}

// Same idea but for panels that need two tables at once (air temp combined,
// rainfall combined) - one request instead of two.
async function fetchTables(tables) {
    const res = await fetch(`/pro-data.php?tables=${tables.map(encodeURIComponent).join(',')}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('bad response');
    const json = await res.json();
    const out = {};
    tables.forEach(t => { out[t] = cleanSeries(json[t]); });
    return out;
}

// --- Gamma Dose Rate ---

let doseChart = null;
function initDosePanel() {
    doseChart = buildLineChart('doseChart', [lineDataset('#f87171')], {
        logarithmic: true,
        yTitle: 'nSv/h',
        // stored as raw Sv/h in the DB, this scales it up to the nSv/h
        // number people are used to seeing
        tickCallback: (value) => Math.round(value * 1_000_000),
        ariaLabel: 'Line chart of recent gamma dose rate readings',
    });
}

async function updateDosePanel() {
    const note = document.getElementById('dose-note');
    try {
        // Same conversion as the axis above - raw reading * 1,000,000 to get
        // nSv/h. Heads up: this table barely has any data (last check it was
        // only a handful of rows, all from 2017), so this panel is mostly
        // historical for now, not live.
        const rows = (await fetchTable('DoseRate')).filter(r => r.y > 0);
        if (!rows.length) throw new Error('no rows');
        doseChart.data.labels = rows.map(r => r.x);
        doseChart.data.datasets[0].data = rows.map(r => r.y);
        doseChart.update();

        const latest = rows[rows.length - 1].y;
        set('latest-dose', Math.round(latest * 1_000_000));
        set('current-dose', Math.round(latest * 1_000_000));
        if (note) note.textContent = 'Historical readings — this sensor reports infrequently';
    } catch (e) {
        set('latest-dose', '—');
        set('current-dose', '—');
        if (note) note.textContent = 'No dose rate data available.';
    }
}

// --- Air Temperature (external + enclosure, same chart) ---

let airTempChart = null;
function initAirTempPanel() {
    airTempChart = buildLineChart('airTempChart', [
        lineDataset('#ee82ee', { label: 'External (°C)', fill: false }),
        lineDataset('#ff6600', { label: 'Enclosure (°C)', fill: false }),
    ], { yTitle: '°C', ariaLabel: 'Line chart of external and enclosure air temperature' });
}

async function updateAirTempPanel() {
    const note = document.getElementById('airtemp-note');
    try {
        const { AirTemp, EnclosureTemp } = await fetchTables(['AirTemp', 'EnclosureTemp']);
        if (!AirTemp.length && !EnclosureTemp.length) throw new Error('no data');

        // use whichever table actually has rows for the x-axis labels
        const labels = (AirTemp.length ? AirTemp : EnclosureTemp).map(r => r.x);
        airTempChart.data.labels = labels;
        airTempChart.data.datasets[0].data = AirTemp.map(r => r.y);
        airTempChart.data.datasets[1].data = EnclosureTemp.map(r => r.y);
        airTempChart.update();

        const latest = AirTemp.length ? AirTemp[AirTemp.length - 1].y : EnclosureTemp[EnclosureTemp.length - 1].y;
        set('latest-airtemp', latest.toFixed(1));
        set('current-airtemp', latest.toFixed(1));
        if (note) note.textContent = 'Pink = External · Orange = Enclosure';
    } catch (e) {
        set('latest-airtemp', '—');
        set('current-airtemp', '—');
        if (note) note.textContent = 'No air temperature data available.';
    }
}

// --- Air Pressure ---

let pressureChart = null;
function initPressurePanel() {
    pressureChart = buildLineChart('pressureChart', [lineDataset('#3333cc')], { yTitle: 'mBar' });
}

async function updatePressurePanel() {
    const note = document.getElementById('pressure-note');
    try {
        const rows = await fetchTable('BarometricPressure');
        if (!rows.length) throw new Error('no data');
        pressureChart.data.labels = rows.map(r => r.x);
        pressureChart.data.datasets[0].data = rows.map(r => r.y);
        pressureChart.update();
        const latest = rows[rows.length - 1].y;
        set('latest-pressure', latest.toFixed(1));
        set('current-pressure', latest.toFixed(1));
        if (note) note.textContent = 'Rooftop weather station';
    } catch (e) {
        set('latest-pressure', '—');
        set('current-pressure', '—');
        if (note) note.textContent = 'No air pressure data available.';
    }
}

// --- Wind Speed ---

let windChart = null;
function initWindPanel() {
    windChart = buildLineChart('windChart', [lineDataset('#32cd32')], { yTitle: 'm/s' });
}

async function updateWindPanel() {
    const note = document.getElementById('wind-note');
    try {
        const rows = await fetchTable('WindSpeed');
        if (!rows.length) throw new Error('no data');
        windChart.data.labels = rows.map(r => r.x);
        windChart.data.datasets[0].data = rows.map(r => r.y);
        windChart.update();
        set('latest-wind', rows[rows.length - 1].y.toFixed(1));
        if (note) note.textContent = 'Rooftop weather station';
    } catch (e) {
        set('latest-wind', '—');
        if (note) note.textContent = 'No wind speed data available.';
    }
}

// --- Solar Radiation ---

let solarChart = null;
function initSolarPanel() {
    solarChart = buildLineChart('solarChart', [lineDataset('#ffcc00')], { yTitle: 'kW' });
}

async function updateSolarPanel() {
    const note = document.getElementById('solar-note');
    try {
        const rows = await fetchTable('SolarRad');
        if (!rows.length) throw new Error('no data');
        solarChart.data.labels = rows.map(r => r.x);
        solarChart.data.datasets[0].data = rows.map(r => r.y);
        solarChart.update();
        set('latest-solar', rows[rows.length - 1].y.toFixed(2));
        if (note) note.textContent = 'Rooftop weather station';
    } catch (e) {
        set('latest-solar', '—');
        if (note) note.textContent = 'No solar radiation data available.';
    }
}

// --- Rainfall (rain + running total, same chart) ---

let rainChart = null;
function initRainPanel() {
    rainChart = buildLineChart('rainChart', [
        lineDataset('#ee82ee', { label: 'Rainfall (mm)', fill: false }),
        lineDataset('#ff6600', { label: 'Rain to Total (mm)', fill: false }),
    ], { yTitle: 'mm' });
}

async function updateRainPanel() {
    const note = document.getElementById('rain-note');
    try {
        const { Rain, RainRunningTotal } = await fetchTables(['Rain', 'RainRunningTotal']);
        if (!Rain.length && !RainRunningTotal.length) throw new Error('no data');

        const labels = (Rain.length ? Rain : RainRunningTotal).map(r => r.x);
        rainChart.data.labels = labels;
        rainChart.data.datasets[0].data = Rain.map(r => r.y);
        rainChart.data.datasets[1].data = RainRunningTotal.map(r => r.y);
        rainChart.update();

        const latest = Rain.length ? Rain[Rain.length - 1].y : RainRunningTotal[RainRunningTotal.length - 1].y;
        set('latest-rain', latest.toFixed(2));
        if (note) note.textContent = 'Pink = Rainfall · Orange = Rain to Total';
    } catch (e) {
        set('latest-rain', '—');
        if (note) note.textContent = 'No rainfall data available.';
    }
}

// --- Relative Humidity ---

let humidityChart = null;
function initHumidityPanel() {
    humidityChart = buildLineChart('humidityChart', [lineDataset('#67e8f9')], { yTitle: '%' });
}

async function updateHumidityPanel() {
    const note = document.getElementById('humidity-note');
    try {
        const rows = await fetchTable('RelativeHumidity');
        if (!rows.length) throw new Error('no data');
        humidityChart.data.labels = rows.map(r => r.x);
        humidityChart.data.datasets[0].data = rows.map(r => r.y);
        humidityChart.update();
        set('latest-humidity', rows[rows.length - 1].y.toFixed(1));
        if (note) note.textContent = 'Rooftop weather station';
    } catch (e) {
        set('latest-humidity', '—');
        if (note) note.textContent = 'No humidity data available.';
    }
}

// --- Radon (RadonEye) ---

let radonEyeChart = null;
function initRadonEyePanel() {
    radonEyeChart = buildLineChart('radonEyeChart', [lineDataset('#6ee7b7')], { yTitle: 'pCi/L' });
}

async function updateRadonEyePanel() {
    const note = document.getElementById('radoneye-note');
    try {
        const rows = await fetchTable('RadonEye');
        if (!rows.length) throw new Error('no data');
        radonEyeChart.data.labels = rows.map(r => r.x);
        radonEyeChart.data.datasets[0].data = rows.map(r => r.y);
        radonEyeChart.update();
        set('latest-radoneye', rows[rows.length - 1].y.toFixed(2));
        if (note) note.textContent = 'RadonEye detector';
    } catch (e) {
        set('latest-radoneye', '—');
        if (note) note.textContent = 'No RadonEye data available.';
    }
}

// --- Sword Spectrum ---
// not totally sure what unit this reads in (spectrum data, not a plain
// scalar like the other sensors), so this just plots whatever "Data" comes
// back without assuming a unit - worth double checking against phpMyAdmin
// if the numbers look off

let swordChart = null;
function initSwordPanel() {
    swordChart = buildLineChart('swordChart', [lineDataset('#86efac')], { yTitle: 'raw reading' });
}

async function updateSwordPanel() {
    const note = document.getElementById('sword-note');
    try {
        const rows = await fetchTable('SwordSpectrum');
        if (!rows.length) throw new Error('no data');
        swordChart.data.labels = rows.map(r => r.x);
        swordChart.data.datasets[0].data = rows.map(r => r.y);
        swordChart.update();
        set('latest-sword', rows[rows.length - 1].y);
        if (note) note.textContent = 'Sword spectrometer';
    } catch (e) {
        set('latest-sword', '—');
        if (note) note.textContent = 'No sword spectrum data available.';
    }
}

// --- Radon (Rad7) ---

let rad7Chart = null;
function initRad7Panel() {
    rad7Chart = buildLineChart('rad7Chart', [lineDataset('#fca5a5')], { yTitle: 'pCi/L' });
}

async function updateRad7Panel() {
    const note = document.getElementById('rad7-note');
    try {
        const rows = await fetchTable('Rad7');
        if (!rows.length) throw new Error('no data');
        rad7Chart.data.labels = rows.map(r => r.x);
        rad7Chart.data.datasets[0].data = rows.map(r => r.y);
        rad7Chart.update();
        set('latest-rad7', rows[rows.length - 1].y.toFixed(2));
        if (note) note.textContent = 'RAD7 detector';
    } catch (e) {
        set('latest-rad7', '—');
        if (note) note.textContent = 'No Rad7 data available.';
    }
}

// runs once the page loads: set up the clock, build all the empty charts,
// then fetch real data into them and keep refreshing every minute
document.addEventListener('DOMContentLoaded', () => {
    initClockAndDates();

    initDosePanel();
    initAirTempPanel();
    initPressurePanel();
    initWindPanel();
    initSolarPanel();
    initRainPanel();
    initHumidityPanel();
    initRadonEyePanel();
    initSwordPanel();
    initRad7Panel();

    const refreshAll = () => {
        updateDosePanel();
        updateAirTempPanel();
        updatePressurePanel();
        updateWindPanel();
        updateSolarPanel();
        updateRainPanel();
        updateHumidityPanel();
        updateRadonEyePanel();
        updateSwordPanel();
        updateRad7Panel();
    };

    refreshAll();
    setInterval(refreshAll, 60000); // 1 min refresh, webapps2 is a real live source
});

window.toggleRadiationsMenu = toggleRadiationsMenu;
