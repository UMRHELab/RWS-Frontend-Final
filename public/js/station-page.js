// Station pages: reports, CSV export, page setup, and initialization
// Handles report popups, data filtering, downloads, and station rendering
// Initialize dashboard clock and displayed dates
function initClockAndDates() {
    setInterval(() => {
        const el = document.getElementById('top-bar-clock');
        if (el) el.textContent = new Date().toLocaleTimeString();
    }, 1000);
    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const de = document.getElementById('greeting-date');
    const md = document.getElementById('modal-generation-date');
    if (de) de.textContent = dateStr;
    if (md) md.textContent = dateStr;
}
// Filter report history using the selected time range
function getFilteredHistory(metric) {
    let hist = history[metric];
    if (!hist) hist = [];

    let from = '';
    const fromEl = document.getElementById('filter-from');
    if (fromEl) from = fromEl.value;

    let to = '';
    const toEl = document.getElementById('filter-to');
    if (toEl) to = toEl.value;

    if (!from && !to) return hist;

    const result = [];
    for (const h of hist) {
        if (!h.t) {
            result.push(h);
            continue;
        }
        const hhmm = new Date(h.t).toTimeString().slice(0, 5);
        if (from && hhmm < from) continue;
        if (to && hhmm > to) continue;
        result.push(h);
    }
    return result;
}
// Format one reading using a metric's decimal places and unit
function formatMetricValue(v, meta) {
    return Number(v).toFixed(meta.dec) + meta.unit;
}
// Update report popup statistics and reading table
function renderReportTable(metric) {
    const config = STATIONS_CONFIG[currentStation];
    if (!config || !config.metrics[metric]) return;
    const meta = config.metrics[metric];
    const filtered = getFilteredHistory(metric);

    const vals = [];
    for (const h of filtered) {
        vals.push(h.val);
    }

    let currentText = '--';
    let minText = '--';
    let maxText = '--';
    let avgText = '--';

    if (vals.length) {
        let min = vals[0];
        let max = vals[0];
        let sum = 0;
        for (const v of vals) {
            if (v < min) min = v;
            if (v > max) max = v;
            sum += v;
        }
        currentText = formatMetricValue(vals[vals.length - 1], meta);
        minText = formatMetricValue(min, meta);
        maxText = formatMetricValue(max, meta);
        avgText = formatMetricValue(sum / vals.length, meta);
    }

    setText('modal-stat-current', currentText);
    setText('modal-stat-min', minText);
    setText('modal-stat-max', maxText);
    setText('modal-stat-avg', avgText);

    const tableRows = document.getElementById('modal-table-rows');
    if (tableRows) {
        if (filtered.length) {
            const reversed = filtered.slice().reverse();
            let rowsHtml = '';
            for (let i = 0; i < reversed.length; i++) {
                const h = reversed[i];
                rowsHtml += `<tr class="hover:bg-slate-50">
                    <td class="px-4 py-2 font-mono text-slate-400">${filtered.length - i}</td>
                    <td class="px-4 py-2">${h.ts}</td>
                    <td class="px-4 py-2 text-right font-mono font-bold">${formatMetricValue(h.val, meta)}</td>
                </tr>`;
            }
            tableRows.innerHTML = rowsHtml;
        } else {
            tableRows.innerHTML = `<tr>
                <td colspan="3" class="px-4 py-6 text-center text-slate-400 text-xs">
                    No readings in this time range.
                </td>
            </tr>`;
        }
    }
}
// Open report popup for selected metric
function openReportPopup(metric) {
    activeMetric = metric;
    const config = STATIONS_CONFIG[currentStation];
    if (!config || !config.metrics[metric]) return;

    setText('modal-metric-title', config.metrics[metric].label);

    // Set default filter range based on available history
    let hist = history[metric];
    if (!hist) hist = [];
    if (hist.length) {
        const fromEl = document.getElementById('filter-from');
        const toEl = document.getElementById('filter-to');
        if (fromEl && !fromEl.value && hist[0].t) {
            fromEl.value = new Date(hist[0].t)
                .toTimeString()
                .slice(0, 5);
        }
        if (toEl && !toEl.value && hist[hist.length - 1].t) {
            toEl.value = new Date(hist[hist.length - 1].t)
                .toTimeString()
                .slice(0, 5);
        }
    }
    renderReportTable(metric);
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.remove('hidden');
}
// Apply selected report time filter
function applyTimeFilter() {
    if (activeMetric) {
        renderReportTable(activeMetric);
    }
}
// Clear report time filter
function clearTimeFilter() {
    const fromEl = document.getElementById('filter-from');
    const toEl = document.getElementById('filter-to');
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    if (activeMetric) {
        renderReportTable(activeMetric);
    }
}
// Close report popup and reset filters
function closeReportPopup() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    activeMetric = null;
    const fromEl = document.getElementById('filter-from');
    const toEl = document.getElementById('filter-to');
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
}
// Export station history as a CSV file
function downloadAllCombinedCSV() {
    const config = STATIONS_CONFIG[currentStation];
    if (!config) return;
    // Build CSV rows from stored history data
    // Uses station configuration to determine column order and formatting
    const keys = Object.keys(config.metrics);

    let maxLen = 0;
    for (const k of keys) {
        if (history[k].length > maxLen) maxLen = history[k].length;
    }

    const rows = [config.csvHeaders];
    for (let i = 0; i < maxLen; i++) {
        let ts = '';
        // All metrics share the same collection interval
        // Use the first available timestamp
        for (const k of keys) {
            const point = history[k][i];
            if (point && point.ts) {
                ts = point.ts;
                break;
            }
        }
        const row = [ts];
        for (const k of keys) {
            const point = history[k][i];
            let val = null;
            if (point) val = point.val;
            if (val != null) {
                row.push(Number(val).toFixed(config.metrics[k].dec));
            } else {
                row.push('');
            }
        }
        rows.push(row);
    }

    const csvLines = [];
    for (const row of rows) {
        const escapedCells = [];
        for (const v of row) {
            escapedCells.push('"' + String(v).replace(/"/g, '""') + '"');
        }
        csvLines.push(escapedCells.join(','));
    }
    const csv = csvLines.join('\n');

    const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// Apply station-specific content and visibility settings
// One shared station page supports multiple station configurations
function applyStationPage(config) {
    const page = config.page;
    document.title = page.title;
    const hero = document.getElementById('station-hero');
    if (hero) {
        hero.classList.add(page.heroClass);
    }
    setText('station-title', page.h1);
    setText('station-subtitle', page.subtitle);
    setText('station-caption', page.caption);
    setText('station-db-code', page.dbCode);
    setText('info-db-table', page.dbCode);
    setText('info-location', page.location);
    setText('info-instruments', page.instruments);
    setText(
        'modal-station-name',
        page.h1 + ' · Sensor Analytics'
    );
    // Display only metrics available for the selected station
    for (const key in config.metrics) {
        const card = document.getElementById('card-' + key);
        const readout = document.getElementById('readout-' + key);
        if (card) card.hidden = false;
        if (readout) readout.hidden = false;
        setText(
            'label-' + key,
            config.metrics[key].label
        );
    }
    // Highlight selected station in navigation
    const stationNames = [
        'cs-facility',
        'basement',
        'rm1962'
    ];
    for (const name of stationNames) {
        const link = document.getElementById('sidelink-' + name);
        if (!link) continue;
        if (name === currentStation) {
            link.classList.add('active');
            link.classList.remove('inactive');
        } else {
            link.classList.add('inactive');
            link.classList.remove('active');
        }
    }
}
// Initialize dashboard after page load
document.addEventListener('DOMContentLoaded', () => {
    initClockAndDates();
    // Read station selection from URL
    // Example: station.html?station=rm1962
    const fromUrl = new URLSearchParams(window.location.search)
        .get('station');
    if (fromUrl && STATIONS_CONFIG[fromUrl]) {
        currentStation = fromUrl;
    } else if (document.getElementById('station-hero')) {
        currentStation = 'rm1962';
    }
    const config = STATIONS_CONFIG[currentStation];
    if (!config) return;
    if (document.getElementById('station-hero')) {
        applyStationPage(config);
    }
    // Create charts for available metrics
    for (const key in config.metrics) {
        buildChart(key, config.metrics[key]);
    }
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeReportPopup();
            }
        });
    }
    fetchAndUpdate();
    // Stations report new readings approximately every 10 minutes
    // Refreshing once per minute keeps the dashboard current
    setInterval(fetchAndUpdate, 60000);
});
// Expose functions used by HTML onclick handlers
window.openReportPopup = openReportPopup;
window.closeReportPopup = closeReportPopup;
window.applyTimeFilter = applyTimeFilter;
window.clearTimeFilter = clearTimeFilter;
window.downloadAllCombinedCSV = downloadAllCombinedCSV;
