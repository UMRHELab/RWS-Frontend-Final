// Station page data handling
// Fetches live sensor data and updates charts, cards, and reports
// Data source: live-data.php
// Display the station's latest reported timestamp
// Supports both SQL datetime strings and Unix epoch timestamps
function setLastReading(sensor, fromApi) {
    const el = document.getElementById('last-reading');
    if (!el) return;

    let timestamp = null;
    if (sensor) timestamp = sensor.timestamp;

    if (!fromApi || !timestamp) {
        el.textContent = 'Last reading: unavailable (no connection to station database)';
        return;
    }

    const raw = String(timestamp).trim();
    let d;
    if (/^\d+(\.\d+)?$/.test(raw)) {
        d = new Date(parseFloat(raw) * 1000);
    } else {
        d = new Date(raw.replace(' ', 'T'));
    }

    let display = raw;
    if (!isNaN(d)) {
        display = d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    el.textContent = 'Last reading: ' + display;
}
// Show a visible warning when the data on screen isn't a live reading -
// wording depends on which non-live source is currently being shown
function setStaticSnapshotNote(sensor) {
    const el = document.getElementById('static-snapshot-note');
    if (!el) return;

    let message = '';
    if (sensor && sensor.source === 'rwslite-stale') {
        message = 'Data is not updating yet — showing the last 20 readings from before it stopped.';
    }

    el.textContent = message;
    el.hidden = message === '';
}
// Pre-fill charts with a data source's own recent history (used when a sensor
// has gone quiet and would otherwise only ever show one flat point). Runs once.
function seedChartsFromHistory(readings, config) {
    if (historySeeded) return;
    if (!readings || readings.length === 0) return;
    historySeeded = true;
    for (const reading of readings) {
        let time = new Date(String(reading.timestamp || '').replace(' ', 'T'));
        if (isNaN(time)) time = new Date();
        const label = time.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const pushMap = config.updateUI(reading);
        for (const key in config.metrics) {
            const inst = instances[key];
            const val = pushMap[key];
            if (!inst || val == null) continue;
            inst.data.labels.push(label);
            inst.data.datasets[0].data.push(val);
        }
    }
    for (const key in config.metrics) {
        if (instances[key]) instances[key].update();
    }
}
// Fetch new sensor readings and update the dashboard
// Runs 5 sec to refresh cards, charts, and report data
async function fetchAndUpdate() {
    const config = STATIONS_CONFIG[currentStation];
    if (!config) return;
    let sensor = null;
    try {
        const res = await fetch(
            `https://dev-engin-rws.pantheonsite.io/live-data.php?station=${currentStation}`
        );
        if (!res.ok) throw new Error('bad response');
        sensor = (await res.json()).data;
    } catch (_) {
        // Keep sensor empty when the request fails
    }
    // No sensor data available
    // Avoid displaying incorrect values or empty chart points
    if (!sensor) {
        setLastReading(null, false);
        setStaticSnapshotNote(null);
        return;
    }
    // Update current sensor values displayed on the page
    setLastReading(sensor, true);
    setStaticSnapshotNote(sensor);
    const pushMap = config.updateUI(sensor);
    // Ignore duplicate readings from the same timestamp
    if (sensor.timestamp && sensor.timestamp === lastSensorTs) return;
    // If the source included older readings (e.g. a frozen sensor), seed the
    // charts with those first instead of plotting just this one point
    if (sensor.history && sensor.history.length && !historySeeded) {
        seedChartsFromHistory(sensor.history, config);
        if (sensor.timestamp) lastSensorTs = sensor.timestamp;
        return;
    }
    if (sensor.timestamp) {
        lastSensorTs = sensor.timestamp;
    }
    // Use station timestamp when available
    // Fall back to browser time if the timestamp cannot be parsed
    let now = new Date(String(sensor.timestamp || '').replace(' ', 'T'));
    if (isNaN(now)) {
        now = new Date();
    }
    const ts = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const keys = Object.keys(config.metrics);
    const first = instances[keys[0]];
    let labels = [];
    if (first) labels = first.data.labels;
    // Prevent duplicate chart entries for the same timestamp
    if (!first || !labels.length || labels[labels.length - 1] !== ts) {
        for (const key of keys) {
            const inst = instances[key];
            const metric = config.metrics[key];
            if (!inst) continue;

            // Add new data point to chart
            // Missing values remain empty instead of displaying as zero
            let val = pushMap[key];
            if (val === undefined) val = null;
            inst.data.labels.push(ts);
            inst.data.datasets[0].data.push(val);
            // Keep chart size limited to recent readings
            if (inst.data.labels.length > MAX_PTS) {
                inst.data.labels.shift();
                inst.data.datasets[0].data.shift();
            }
            // Store periodic history points for reports
            if (now.getTime() - lastHistoryLogTime >= HISTORY_INTERVAL_MS) {
                history[key].push({ ts: ts, val: val, t: now.getTime() });
                if (history[key].length > MAX_PTS) {
                    history[key].shift();
                }
            }
            // Calculate and display the current chart average
            let sum = 0;
            let count = 0;
            for (const v of inst.data.datasets[0].data) {
                if (v !== null && !isNaN(v)) {
                    sum += v;
                    count++;
                }
            }
            let avg = 0;
            if (count > 0) avg = sum / count;

            const avgEl = document.getElementById(metric.avgId);
            if (avgEl) {
                avgEl.textContent = avg.toFixed(metric.dec);
            }
            inst.update();
        }
        // Save the latest history timestamp
        if (now.getTime() - lastHistoryLogTime >= HISTORY_INTERVAL_MS) {
            lastHistoryLogTime = now.getTime();
        }
        // Refresh report table when a metric is selected
        if (activeMetric) {
            renderReportTable(activeMetric);
        }
    }
}
