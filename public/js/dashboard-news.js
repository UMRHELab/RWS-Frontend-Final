// Homepage: news and highlights from Google Sheets
// Load order: news -> 3d -> charts -> live
// Uses global functions instead of modules
// Retrieves homepage content from shared Google Sheets
// Team members can update content by adding rows directly to the sheets:
// Updates sheet populates the Recent Highlights section
// News sheet populates the News & Updates section
const RWSUpdates = (() => {
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
        return cols.map(c => c.trim());
    }
    // Convert CSV rows into objects using column headers
    // Supports different sheet column ordering and alternate field names
    function parseCSV(text) {
        const lines = text
            .trim()
            .split(/\r?\n/)
            .filter(l => l.trim() !== '');
        if (lines.length < 2) return [];
        const headers = splitCSVLine(lines[0])
            .map(h => h.toLowerCase());
        return lines.slice(1)
            .map(line => {
                const columns = splitCSVLine(line);
                const row = {};
                headers.forEach((h, i) => {
                    row[h] = columns[i] || '';
                });
                // Support alternative spreadsheet column names
                row.description = row.description || row.notes || '';
                row.tag = row.tag || row.status || '';
                return row;
            })
            .filter(row => row.title);
    }
    // Fetch and process spreadsheet data
    async function fetchRows(url) {
        try {
            const r = await fetch(url, {
                cache: 'no-store'
            });
            if (!r.ok) return [];
            const rows = parseCSV(await r.text());
            // Sort newest entries first
            // Supports common date formats such as YYYY-MM-DD and MM/DD/YYYY
            const getTime = d => {
                const parsed = Date.parse(d);
                return isNaN(parsed) ? 0 : parsed;
            };
            rows.sort((a, b) =>
                getTime(b.date) - getTime(a.date)
            );
            return rows;
        } catch {
            return [];
        }
    }
    // Allow only valid icon filenames from the icon directory
    function safeIcon(icon) {
        return /^[\w.-]+\.(png|svg|jpg|jpeg|gif)$/i.test(icon || '')
            ? icon
            : '';
    }
    // Escape user-provided text before inserting into HTML
    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, m =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m])
        );
    }
    return {
        fetchUpdates: () => fetchRows(UPDATES_CSV_URL),
        fetchNews: () => fetchRows(NEWS_CSV_URL),
        safeIcon,
        esc
    };
})();
// Populate Recent Highlights section
document.addEventListener('DOMContentLoaded', () => {
    const box = document.querySelector('.highlights-list');
    if (!box) return;
    RWSUpdates.fetchUpdates().then(updates => {
        if (updates.length === 0) {
            box.innerHTML =
                '<p class="highlights-empty">No recent updates</p>';
            return;
        }
        box.innerHTML = updates
            .slice(0, 4)
            .map(u => {
                const icon = RWSUpdates.safeIcon(u.icon);
                const badge = icon
                    ? `
                    <div class="highlight-badge highlight-badge--img">
                        <img 
                            src="../icon/${icon}" 
                            alt=""
                            onerror="this.parentElement.innerHTML='✓';this.parentElement.className='highlight-badge highlight-badge--ok'"
                        >
                    </div>`
                    : `
                    <div class="highlight-badge highlight-badge--ok">
                        ✓
                    </div>`;
                return `
                <div class="highlight-row">
                    <div class="highlight-left">
                        ${badge}
                        <div class="highlight-text">
                            <h4 class="white">
                                ${RWSUpdates.esc(u.title)}
                            </h4>
                            <p>
                                ${RWSUpdates.esc(u.description)}
                            </p>
                        </div>
                    </div>
                    <span class="highlight-time">
                        ${RWSUpdates.esc(u.date)}
                    </span>
                </div>`;
            })
            .join('');
    });
});
// Populate News & Updates section
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.news-grid');
    if (!grid) return;
    const TAGS = {
        update: 'Update',
        maintenance: 'Maintenance',
        info: 'Info'
    };
    RWSUpdates.fetchNews().then(news => {
        if (news.length === 0) {
            grid.innerHTML =
                '<p class="highlights-empty">No news yet</p>';
            return;
        }
        grid.innerHTML = news
            .map(n => {
                const tagKey = (n.tag || '').toLowerCase();
                const tag = TAGS[tagKey]
                    ? tagKey
                    : 'info';
                return `
                <div class="news-card">
                    <div class="news-card-tag news-tag--${tag}">
                        ${TAGS[tag]}
                    </div>
                    <h3>
                        ${RWSUpdates.esc(n.title)}
                    </h3>
                    <p>
                        ${RWSUpdates.esc(n.description)}
                    </p>
                    <span class="news-date">
                        ${RWSUpdates.esc(n.date)}
                    </span>
                </div>`;
            })
            .join('');
    });
});
