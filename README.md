# RWS Frontend

shows live readings from 3 spots: CS Facility roof, Room 1962, and the basement

---

## how it works (kinda)

basically every station's hardware (RAD8, BME680, that CR1000 datalogger thing, etc) logs a reading every ~10 min. `live-data.php` grabs the latest one and hands it back as JSON — it tries the campus mysql db first, and if that's not reachable it falls back to a dropbox csv that gets synced from the lab computer (RAD8 and room 1962 data mainly). the dashboard js just polls that endpoint once a minute and shovels the numbers into the cards/charts/badges.

```
instruments  →  campus DB / dropbox csv  →  live-data.php  →  dashboard js (polls every 60s)
```

---

## what's in here

```
public/js/     all the dashboard + station page js (see below, too many files to list twice)
public/*.html  index.html (homepage), station.html (the shared station page for all 3 stations)
styles/        css, split by page/section
sensors/       python driver per sensor
database/      db helper + schema stuff
data/          local sqlite db for testing
app/           tiny flask dev server thing (reads data/sensorData.db)
RWS.py         the main loop that actually runs on the pi
```

`live-data.php` (the actual api the site calls) is NOT in this folder, it lives up at the site root since it's shared with the rest of the wordpress site. easy to forget that when you're looking for it.

---

## the pages

- `index.html` — homepage, all 3 stations at a glance
- `station.html?station=basement|cs-facility|rm1962` — one page, url param picks which station config to load. the old `basement.html`/`cs-facility.html`/`rm1962.html` redirect stubs got deleted since they weren't doing anything anymore, so old bookmarked links to those will just 404 now

---

## files worth knowing (aka where tf is the code)

**station page js** (loads in this order on `station.html`):

- `station-config.js` — shared state + `STATIONS_CONFIG`, the giant object with literally everything different between the 3 stations (titles, metrics, colors, an `updateUI` fn). want a 4th station? just add an entry here, don't touch anything else
- `station-charts.js` — makes the Chart.js line charts + the dashed "AVG" line plugin
- `station-data.js` — `fetchAndUpdate()`, the main polling loop, grabs the latest reading and pushes new points onto the charts
- `station-page.js` — report popup, csv export, page setup, and the startup code that reads `?station=` off the url

**homepage js**:

- `dashboard-news.js` — pulls the highlights/news sections from two google sheets published as csv (no cms needed, just edit the sheet)
- `dashboard-3d.js` — the 3d building thing, purely for looks, doesn't affect anything else
- `dashboard-charts.js` — the 6 little sparkline charts on the homepage
- `dashboard-live.js` — fetches all 4 station feeds at once, merges them with fallbacks (room sensor first, then RAD8), updates everything every minute

**`footer.js`** — shared across every page, loads the footer html, builds the mobile nav, keeps the sidebar station dots synced

**`live-data.php`** — queries the campus db or the RAD8 dropbox csv, spits back the latest row as json. `?station=rm1962` etc. again, this lives at the site root not in here

**`RWS.py`** — runs on the pi, reads all the sensors, writes to sqlite

**`sensors/`** — one file per sensor: BME680, soil moisture, soil temp, wind/rain, wind direction, geiger counter, RadonEye bluetooth thing

---

## running this locally

just open `public/index.html` in a browser, no server needed. the js hits the real live api directly so you'll see actual data as long as you're online.

`RWS.py` needs the actual pi hardware to run, no simulation mode anymore, no more fake numbers getting written to the db.
