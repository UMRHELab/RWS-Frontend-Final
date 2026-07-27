// Station page data handling
// Fetches live sensor data and updates charts, cards, and reports
// Data source: live-data.php
// Display the station's latest reported timestamp
// Supports both SQL datetime strings and Unix epoch timestamps
function setLastReading(sensor, fromApi) {
    const el = document.getElementById('last-reading');
    if (!el) return;
    if (!fromApi || !sensor?.timestamp) {
        el.textContent = 'Last reading: unavailable (no connection to station database)';
        return;
    }
    const raw = String(sensor.timestamp).trim();
    const d = /^\d+(\.\d+)?$/.test(raw)
        ? new Date(parseFloat(raw) * 1000)
        : new Date(raw.replace(' ', 'T'));
    el.textContent = 'Last reading: ' + (
        isNaN(d)
            ? raw
            : d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            })
    );
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
        return;
    }
    // Update current sensor values displayed on the page
    setLastReading(sensor, true);
    const pushMap = config.updateUI(sensor);
    // Ignore duplicate readings from the same timestamp
    if (sensor.timestamp && sensor.timestamp === lastSensorTs) return;
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
    const labels = first?.data.labels;
    // Prevent duplicate chart entries for the same timestamp
    if (!first || !labels.length || labels[labels.length - 1] !== ts) {
        keys.forEach(key => {
            const inst = instances[key];
            const metric = config.metrics[key];
            if (!inst) return;
            // Add new data point to chart
            // Missing values remain empty instead of displaying as zero
            const val = pushMap[key] ?? null;
            inst.data.labels.push(ts);
            inst.data.datasets[0].data.push(val);
            // Keep chart size limited to recent readings
            if (inst.data.labels.length > MAX_PTS) {
                inst.data.labels.shift();
                inst.data.datasets[0].data.shift();
            }
            // Store periodic history points for reports
            if (now.getTime() - lastHistoryLogTime >= HISTORY_INTERVAL_MS) {
                history[key].push({
                    ts,
                    val,
                    t: now.getTime()
                });
                if (history[key].length > MAX_PTS) {
                    history[key].shift();
                }
            }
            // Calculate and display the current chart average
            const vals = inst.data.datasets[0].data
                .filter(v => !isNaN(v) && v !== null);
            const avg = vals.length
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : 0;
            const avgEl = document.getElementById(metric.avgId);
            if (avgEl) {
                avgEl.textContent = avg.toFixed(metric.dec);
            }
            inst.update();
        });
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
