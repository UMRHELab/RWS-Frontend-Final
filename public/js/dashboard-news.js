// Homepage: news and highlights from Google Sheets
// Load order: news -> 3d -> charts -> live
// Retrieves homepage content from shared Google Sheets
// Team members can update content by adding rows directly to the sheets:
// Updates sheet populates the Recent Highlights section
// News sheet populates the News & Updates section
const UPDATES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjLt42NKFE3yuZuJtxkWRj2fthgy0gpmPTNe_jYKziWHULaKSyapqStR1hn3qHoPigQVprJE1Q3TYY/pub?gid=0&single=true&output=csv';
const NEWS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQba-I86uAOYnBP3C7n6SOkHMGKqo72eNM6N4tfpe5WDs-KVBj0WrftIFyNQqcxG1piw7ZwPjsZmMu-/pub?gid=0&single=true&output=csv';

// Parse a CSV row while supporting quoted values with commas
function splitCSVLine(line) {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            cols.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    cols.push(cur);

    const trimmed = [];
    for (const col of cols) {
        trimmed.push(col.trim());
    }
    return trimmed;
}

// Convert CSV rows into objects using column headers
// Supports different sheet column ordering and alternate field names
function parseCSV(text) {
    const rawLines = text.trim().split(/\r?\n/);
    const lines = [];
    for (const line of rawLines) {
        if (line.trim() !== '') lines.push(line);
    }
    if (lines.length < 2) return [];

    const rawHeaders = splitCSVLine(lines[0]);
    const headers = [];
    for (const h of rawHeaders) {
        headers.push(h.toLowerCase());
    }

    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const columns = splitCSVLine(lines[i]);
        const row = {};
        for (let h = 0; h < headers.length; h++) {
            row[headers[h]] = columns[h] || '';
        }
        // Support alternative spreadsheet column names
        if (!row.description) row.description = row.notes || '';
        if (!row.tag) row.tag = row.status || '';
        if (row.title) result.push(row);
    }
    return result;
}

// Sorts rows newest-first. Supports common date formats such as
// YYYY-MM-DD and MM/DD/YYYY; unparseable dates sort to the bottom.
function compareByDateDesc(a, b) {
    return parseDateOrZero(b.date) - parseDateOrZero(a.date);
}
function parseDateOrZero(d) {
    const parsed = Date.parse(d);
    if (isNaN(parsed)) return 0;
    return parsed;
}

// Fetch and process spreadsheet data
async function fetchRows(url) {
    try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return [];
        const rows = parseCSV(await r.text());
        rows.sort(compareByDateDesc);
        return rows;
    } catch (e) {
        return [];
    }
}
function fetchUpdates() {
    return fetchRows(UPDATES_CSV_URL);
}
function fetchNews() {
    return fetchRows(NEWS_CSV_URL);
}

// Allow only valid icon filenames from the icon directory
function safeIcon(icon) {
    let name = icon;
    if (!name) name = '';
    if (/^[\w.-]+\.(png|svg|jpg|jpeg|gif)$/i.test(name)) {
        return name;
    }
    return '';
}

// Escape user-provided text before inserting into HTML
function esc(s) {
    let text = String(s || '');
    text = text.split('&').join('&amp;');
    text = text.split('<').join('&lt;');
    text = text.split('>').join('&gt;');
    text = text.split('"').join('&quot;');
    text = text.split("'").join('&#39;');
    return text;
}

// Populate Recent Highlights section
document.addEventListener('DOMContentLoaded', async () => {
    const box = document.querySelector('.highlights-list');
    if (!box) return;

    const updates = await fetchUpdates();
    if (updates.length === 0) {
        box.innerHTML = '<p class="highlights-empty">No recent updates</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < updates.length && i < 4; i++) {
        const u = updates[i];
        const icon = safeIcon(u.icon);

        let badge = `
            <div class="highlight-badge highlight-badge--ok">
                ✓
            </div>`;
        if (icon) {
            badge = `
            <div class="highlight-badge highlight-badge--img">
                <img
                    src="../icon/${icon}"
                    alt=""
                    onerror="this.parentElement.innerHTML='✓';this.parentElement.className='highlight-badge highlight-badge--ok'"
                >
            </div>`;
        }

        html += `
            <div class="highlight-row">
                <div class="highlight-left">
                    ${badge}
                    <div class="highlight-text">
                        <h4 class="white">
                            ${esc(u.title)}
                        </h4>
                        <p>
                            ${esc(u.description)}
                        </p>
                    </div>
                </div>
                <span class="highlight-time">
                    ${esc(u.date)}
                </span>
            </div>`;
    }
    box.innerHTML = html;
});

// Populate News & Updates section
document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.querySelector('.news-grid');
    if (!grid) return;

    const news = await fetchNews();
    if (news.length === 0) {
        grid.innerHTML = '<p class="highlights-empty">No news yet</p>';
        return;
    }

    let html = '';
    for (const n of news) {
        let tagKey = n.tag;
        if (!tagKey) tagKey = '';
        tagKey = tagKey.toLowerCase();

        let tagClass = 'info';
        if (tagKey === 'update' || tagKey === 'maintenance' || tagKey === 'info') {
            tagClass = tagKey;
        }

        let tagLabel = 'Info';
        if (tagClass === 'update') tagLabel = 'Update';
        if (tagClass === 'maintenance') tagLabel = 'Maintenance';

        html += `
            <div class="news-card">
                <div class="news-card-tag news-tag--${tagClass}">
                    ${tagLabel}
                </div>
                <h3>
                    ${esc(n.title)}
                </h3>
                <p>
                    ${esc(n.description)}
                </p>
                <span class="news-date">
                    ${esc(n.date)}
                </span>
            </div>`;
    }
    grid.innerHTML = html;
});
