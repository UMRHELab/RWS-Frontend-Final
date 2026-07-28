// Homepage: live sensor data, status indicators, popups, and CSV export
// Fetches live readings, updates dashboard cards/charts, and initializes page features

// Update the top navigation clock every second
function updateClock() {
    const el = document.getElementById('top-bar-clock');
    if (el) el.textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);

// Display time-based greeting and current date
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good Evening!';
    if (hour < 12) {
        greeting = 'Good Morning!';
    } else if (hour < 17) {
        greeting = 'Good Afternoon!';
    }
    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) greetingEl.textContent = greeting;

    const dateEl = document.getElementById('greeting-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}
setGreeting();

// Show text in an element if it exists
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Radiation status display
// Updates the radiation card text and level class based on current radon levels
// Thresholds follow the EPA action level reference of 4 pCi/L
// All coloring lives in index.css under .rad-normal / .rad-elevated / .rad-high
const RADON_LEVELS = [
    { below: 2, cls: 'rad-normal', label: 'Normal', title: 'Safe range.', text: 'Below the EPA action level of 4 pCi/L.' },
    { below: 4, cls: 'rad-elevated', label: 'Elevated', title: 'Elevated.', text: 'Approaching the EPA action level of 4 pCi/L.' },
    { below: Infinity, cls: 'rad-high', label: 'High', title: 'High level.', text: 'Above the EPA action level of 4 pCi/L. Expected in the lab when sources are present.' }
];

function setRadiationStatus(pci) {
    if (pci == null || isNaN(pci)) return;

    let lvl = null;
    for (const level of RADON_LEVELS) {
        if (pci < level.below) {
            lvl = level;
            break;
        }
    }

    // JS only updates the text — the colors come from css
    setElementText('rad-status-text', lvl.label);
    setElementText('rad-info-title', lvl.title);
    setElementText('rad-info-text', lvl.text);

    let rangeText = 'Higher than typical background';
    if (pci < 4) {
        rangeText = 'Typical background radiation';
    }
    setElementText('rad-range-text', rangeText);

    // Swap the level class on the panel, css does the rest
    const panel = document.querySelector('.rad-panel');
    if (panel) {
        panel.classList.remove('rad-normal', 'rad-elevated', 'rad-high', 'rad-unavailable');
        panel.classList.add(lvl.cls);
    }
}

// Shown instead of setRadiationStatus() when no radon sensor is currently
// reporting, so the card doesn't keep showing a leftover "Normal" reading
function setRadiationUnavailable() {
    setElementText('current-rad', '—');
    setElementText('rad-status-text', 'No data');
    setElementText('rad-info-title', 'No reading available.');
    setElementText('rad-info-text', 'Waiting for a radon sensor to report.');
    setElementText('rad-range-text', 'No radon sensor is currently reporting');

    const panel = document.querySelector('.rad-panel');
    if (panel) {
        panel.classList.remove('rad-normal', 'rad-elevated', 'rad-high');
        panel.classList.add('rad-unavailable');
    }
}

// Station online/offline status indicators
// A station is considered online when its latest reading is less than one hour old
const ONLINE_MAX_AGE_MS = 60 * 60 * 1000;

// Convert database timestamps into Date objects
// Supports SQL datetime strings and Unix epoch timestamps
function parseDbTime(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();

    let d;
    if (/^\d+(\.\d+)?$/.test(s)) {
        d = new Date(parseFloat(s) * 1000);
    } else {
        d = new Date(s.replace(' ', 'T'));
    }
    if (isNaN(d)) return null;
    return d;
}

function setStationBadge(id, data) {
    const box = document.getElementById(id);
    if (!box) return;

    let timestamp = null;
    if (data) timestamp = data.timestamp;
    const t = parseDbTime(timestamp);
    const online = !!t && (Date.now() - t.getTime()) < ONLINE_MAX_AGE_MS;

    // Colors and the pulse animation come from css via these classes
    box.classList.toggle('is-online', online);
    box.classList.toggle('is-offline', !online);

    const label = box.querySelector('.station-status-label');
    if (label) {
        if (online) {
            label.textContent = 'ONLINE';
        } else {
            label.textContent = 'OFFLINE';
        }
    }
}

// Update environment overview message based on available sensors
function setEnvNote(rad8, room, roof) {
    const note = document.querySelector('.env-pro-note');
    if (!note) return;

    if (!rad8 && !room) {
        note.textContent = "Sensors aren't reporting right now. Waiting for new readings.";
        return;
    }

    let src = 'RAD8 monitor (main lab)';
    if (room && room.source !== 'rad8-fallback') {
        src = 'RWS-Lite (Rm 1962)';
    }

    let roofNote = ', with wind/rain/solar data appearing once the rooftop logger connection is available';
    if (roof) {
        roofNote = '';
    }

    note.textContent = `Live readings from the ${src}${roofNote}.`;
}

function setLiveBadge(text) {
    setElementText('live-badge-text', text);
}

// Fallback state for temporary connection issues
// Keeps the last successful reading so a single failed poll does not
// clear the page. Readings older than 15 minutes are discarded.
let lastGoodSensor = null;
let lastGoodAt = 0;
const LAST_GOOD_MAX_AGE_MS = 15 * 60 * 1000;

// Timestamp of the newest reading already drawn on the charts
// New points are only added when the instruments log a new reading
// (the RAD8 reports roughly every 10 minutes), not on every poll.
let lastPlottedTs = null;

// Pre-fill temp/humidity/radon charts with the RAD8's recent history
// so the graphs do not start empty. Runs once.
// Wind/rain/solar have no historical source and stay empty.
let chartsSeeded = false;

function seedChartsFromHistory(history) {
    if (chartsSeeded) return;
    if (!history || history.length === 0) return;
    chartsSeeded = true;

    for (const reading of history) {
        let time = parseDbTime(reading.timestamp);
        if (!time) time = new Date();
        const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        addSeedPoint('temp', label, reading.ambient_temp_f);
        addSeedPoint('humidity', label, reading.relative_humidity);
        addSeedPoint('radon', label, reading.radon_pci_l);
    }

    if (CHARTS.temp.chart) CHARTS.temp.chart.update();
    if (CHARTS.humidity.chart) CHARTS.humidity.chart.update();
    if (CHARTS.radon.chart) CHARTS.radon.chart.update();

    // Remember the newest seeded reading so the update loop does not replot it
    lastPlottedTs = history[history.length - 1].timestamp;
}

// Add one value to one chart
function addSeedPoint(key, label, value) {
    if (value == null) return;
    CHARTS[key].labels.push(label);
    CHARTS[key].data.push(value);
}

// Request one station's latest reading, returns null on failure
async function fetchStation(station) {
    try {
        const res = await fetch('https://dev-engin-rws.pantheonsite.io/live-data.php?station=' + station);
        const json = await res.json();
        return json.data;
    } catch (e) {
        return null;
    }
}

// Fetch all four station feeds in parallel; each one resolves to null on failure
async function fetchAllStations() {
    const [room, roof, rad8, basement] = await Promise.all([
        fetchStation('rm1962'),
        fetchStation('cs-facility'),
        fetchStation('rad8'),
        fetchStation('basement'),
    ]);
    return { room, roof, rad8, basement };
}

// Reads one field from a sensor reading, or null if the sensor is missing
function fromSensor(sensor, field) {
    if (sensor && sensor[field] != null) return sensor[field];
    return null;
}

// Combine the separate station feeds into one reading for the homepage.
// The RAD8 (Dropbox CSV) backs up the room sensor since it's in the same room.
function mergeSensorReading(stations) {
    const room = stations.room;
    const roof = stations.roof;
    const rad8 = stations.rad8;

    let timestamp = fromSensor(rad8, 'timestamp');
    if (timestamp == null) timestamp = fromSensor(room, 'timestamp');
    if (timestamp == null) timestamp = fromSensor(roof, 'timestamp');

    let indoorTemp = fromSensor(room, 'indoor_temp');
    if (indoorTemp == null) indoorTemp = fromSensor(rad8, 'ambient_temp_f');

    let indoorHumidity = fromSensor(room, 'indoor_humidity');
    if (indoorHumidity == null) indoorHumidity = fromSensor(rad8, 'relative_humidity');

    // Use the RAD8's radon concentration in pCi/L, not counts per minute
    let radiation = fromSensor(rad8, 'radon_pci_l');
    if (radiation == null) radiation = fromSensor(room, 'radiation');

    let radonLevel = fromSensor(room, 'radon_level');
    if (radonLevel == null) radonLevel = fromSensor(rad8, 'radon_pci_l');

    return {
        timestamp: timestamp,
        indoor_temp: indoorTemp,
        indoor_humidity: indoorHumidity,
        radiation: radiation,
        radon_level: radonLevel,
        wind_speed: fromSensor(roof, 'wind_speed'),
        rainfall: fromSensor(roof, 'rainfall'),
        lux: fromSensor(roof, 'lux'),
    };
}

// Set an element's text to a rounded number, only if there's an actual value
function setReadout(id, val, dec) {
    if (val != null) setElementText(id, Number(val).toFixed(dec));
}

// Update every number on the page that shows the current sensor reading
function updateReadouts(sensor) {
    setReadout('current-temp', sensor.indoor_temp, 1);
    setReadout('current-humidity', sensor.indoor_humidity, 1);
    setReadout('current-wind', sensor.wind_speed, 1);
    setReadout('current-rain', sensor.rainfall, 2);
    setReadout('current-solar', sensor.lux, 0);
    setReadout('current-radon', sensor.radon_level, 2);
    // weather-temp is NOT set here - it's Ann Arbor's real outdoor temperature
    // from a public weather API (see footer.js), not this station's own sensor

    // Header pill keeps its °F suffix
    if (sensor.indoor_temp != null) {
        setElementText('nav-temp', Number(sensor.indoor_temp).toFixed(0) + '°F');
    }

    if (sensor.radiation != null) {
        setReadout('current-rad', sensor.radiation, 0);
        setRadiationStatus(Number(sensor.radiation));
    } else {
        setRadiationUnavailable();
    }
}

// Push a new point onto each chart, but only when the instruments actually
// logged something new (not on every 60s poll)
function plotNewReading(sensor) {
    if (sensor.timestamp) {
        if (sensor.timestamp === lastPlottedTs) return; // nothing new yet
        lastPlottedTs = sensor.timestamp;
    }

    // Use the instrument's own clock, browser clock as backup
    let readingTime = parseDbTime(sensor.timestamp);
    if (!readingTime) readingTime = new Date();
    const ts = readingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const values = {
        temp: sensor.indoor_temp,
        humidity: sensor.indoor_humidity,
        wind: sensor.wind_speed,
        rain: sensor.rainfall,
        solar: sensor.lux,
        radon: sensor.radon_level,
    };

    for (const key in values) {
        const cfg = CHARTS[key];
        if (!cfg) continue;

        let val = values[key];
        if (val === undefined) val = null; // offline sensor = gap in the chart, not a fake flat line

        cfg.labels.push(ts);
        cfg.data.push(val);
        if (cfg.labels.length > MAX_POINTS) {
            cfg.labels.shift();
            cfg.data.shift();
        }
        if (cfg.chart) cfg.chart.update();
    }
}

// Main update loop: fetch the latest readings and push them into the page. Runs every minute.
async function updateLiveChart() {
    let sensor;
    try {
        const stations = await fetchAllStations();
        const room = stations.room;
        const roof = stations.roof;
        const rad8 = stations.rad8;
        const basement = stations.basement;

        // Bail only if nothing answered at all
        if (!room && !roof && !rad8) {
            throw new Error('no data returned from live-data.php');
        }

        let rad8History = null;
        if (rad8) rad8History = rad8.history;
        seedChartsFromHistory(rad8History); // first fetch only
        setStationBadge('status-cs-facility', roof);
        setStationBadge('status-rm1962', room);
        setStationBadge('status-basement', basement);
        setEnvNote(rad8, room, roof);

        sensor = mergeSensorReading(stations);

        // rm1962/rad8 are real live sensors. roof (cs-facility) falls back to a
        // fixed historical snapshot whenever Pantheon can't reach the campus db,
        // which is always the case here - so its timestamp alone should never
        // be shown as a "Live" reading.
        if (rad8 || room) {
            const readAt = parseDbTime(sensor.timestamp);
            if (readAt) {
                setLiveBadge('Live • last reading ' + readAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
            } else {
                setLiveBadge('Live');
            }
        } else {
            setLiveBadge('No live sensors reporting');
        }

        lastGoodSensor = sensor;
        lastGoodAt = Date.now();
    } catch (e) {
        // Poll failed — reuse the last good reading if it is recent enough
        if (lastGoodSensor && (Date.now() - lastGoodAt) < LAST_GOOD_MAX_AGE_MS) {
            sensor = lastGoodSensor;
        } else {
            // Nothing to show — go offline instead of inventing numbers
            console.warn('Sensor fetch failed, no recent data to show:', e);
            setEnvNote(null, null, null);
            setLiveBadge('Offline');
            return;
        }
    }

    if (!sensor) return;
    updateReadouts(sensor);
    plotNewReading(sensor);
}

// "What we measure" popup
function openMeasureInfo() {
    const modal = document.getElementById('measure-info-modal');
    if (modal) modal.classList.remove('hidden');
}
function closeMeasureInfo() {
    const modal = document.getElementById('measure-info-modal');
    if (modal) modal.classList.add('hidden');
}

// Radiation info popup
function openRadiationInfo() {
    const modal = document.getElementById('rad-info-modal');
    if (modal) modal.classList.remove('hidden');
}
function closeRadiationInfo() {
    const modal = document.getElementById('rad-info-modal');
    if (modal) modal.classList.add('hidden');
}

// Close a modal when its backdrop (not its content) is clicked
function setupModalBackdropClose(modalId, closeFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener('click', e => {
        if (e.target === modal) closeFn();
    });
}
window.addEventListener('DOMContentLoaded', () => {
    setupModalBackdropClose('measure-info-modal', closeMeasureInfo);
    setupModalBackdropClose('rad-info-modal', closeRadiationInfo);
});

// How many decimal places each column gets in the CSV export
const CSV_DECIMALS = { temp: 1, humidity: 1, wind: 1, rain: 3, solar: 0, radon: 2 };

// Build a CSV with all six sensor columns and download it
function exportAllStationsCSV() {
    const keys = Object.keys(CHARTS);

    let maxLen = 0;
    for (const k of keys) {
        if (CHARTS[k].labels.length > maxLen) maxLen = CHARTS[k].labels.length;
    }
    if (maxLen === 0) {
        alert('No data collected yet.');
        return;
    }

    // Use the chart with the most points as the timestamp source
    let timestamps = [];
    for (const k of keys) {
        if (CHARTS[k].labels.length === maxLen) {
            timestamps = CHARTS[k].labels;
            break;
        }
    }

    const colKeys = ['temp', 'humidity', 'wind', 'rain', 'solar', 'radon'];
    const headers = ['Timestamp', 'Temp (°F)', 'Humidity (%)', 'Wind (mph)', 'Rainfall (in)', 'Solar (lx)', 'Radon (pCi/L)'];
    const rows = [headers];

    for (let i = 0; i < maxLen; i++) {
        const row = [timestamps[i] || ''];
        for (const key of colKeys) {
            const val = CHARTS[key].data[i];
            if (val != null) {
                row.push(Number(val).toFixed(CSV_DECIMALS[key]));
            } else {
                row.push('');
            }
        }
        rows.push(row);
    }

    downloadCSV(rows, `RWS_AllStations_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSV(rows, filename) {
    const lines = [];
    for (const row of rows) {
        lines.push(row.join(','));
    }
    const csv = lines.join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = filename;
    a.click();
}

// Start everything once the page loads
window.onload = function () {
    initThree();
    initAllCharts();
    updateLiveChart();
    // Poll every minute; points are only added when there is a new reading
    setInterval(updateLiveChart, 60000);
};
