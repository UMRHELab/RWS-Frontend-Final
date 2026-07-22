# RWS-Lite

Live sensor dashboard for the U-M Radiation Weather Station. Three locations: CS Facility roof, Room 1962, and the basement, plus a RAD8 radon monitor feeding the homepage radiation card. No framework, no build step — just HTML, CSS, and JS.

Live at: https://dev-engin-rws.pantheonsite.io/rws-lite/ (dev environment, deployed through the engin-rws Pantheon site)

---

## How it works

The Raspberry Pi runs `RWS.py` on a loop, reads all the sensors every 5 seconds, and saves to a local SQLite database. That data gets synced up to the `rws_data` database on webapps2 (MiServer), and the dashboard pulls from `live-data.php` every 5 seconds to update the charts.

```
Sensors → Pi (RWS.py) → MySQL rws_data @ webapps2 → live-data.php → Dashboard
```

The dashboard shows the newest real row it can get, and it's honest about freshness: every station card has an ONLINE/OFFLINE badge based on whether the station reported within the last hour, and each station page shows a "Last reading" date. If a station goes quiet you see its last known data with a stamp, not made-up numbers. See `BRINGING_STATIONS_ONLINE.md` for how to revive a dead station.

Dev updates and news on the homepage come from shared Google Sheets — add a row in the sheet and it shows up on the site, no code changes needed.

---

## What's in here

```
public/      HTML pages + JS
styles/      CSS, one file per page (styles.css also has the mobile layout)
sensors/     Python drivers for each sensor
database/    DB helpers and schema
data/        Local SQLite file for testing
app/         Local Flask server for testing, not used by the live site
RWS.py       Main sensor loop, runs on the Pi
```

---

## The pages

- `index.html` — homepage: station map, environment overview, radiation card, highlights and news
- `cs-facility.html` — roof: temp, wind, solar, rainfall
- `rm1962.html` — room 1962: temp, humidity, radiation, air pressure
- `basement.html` — basement: radon, temp, soil moisture, soil temp

The site works on phones too: below 820px the sidebar becomes a hamburger menu and everything stacks into one column.

---

## Files worth knowing

**`station-manager.js`** — shared script for all three station pages. figures out which station it's on, polls the API, updates charts, shows the last-reading stamp, handles CSV export and the report popup.

**`dashboard.js`** — powers the homepage. station map, environment overview, google sheet feeds for highlights and news, the radiation card (colors itself green/orange/red against the EPA 4 pCi/L action level), and the online/offline badges.

**`footer.js`** — loads the shared footer, runs the mobile hamburger menu, and swaps the sidebar station icons between online and offline.

**`live-data.php`** — queries the database and returns the latest sensor row as JSON. usage: `?station=rm1962` (also `cs-facility`, `basement`, `rad8`). lives at the root of the engin-rws Pantheon repo, not in this one, so there's only one copy to keep current

**`RWS.py`** — runs on the Pi, reads sensors, writes to SQLite.

**`sensors/`** — one file per sensor (BME680, soil moisture, soil temp, wind/rain, wind direction, Geiger counter, RadonEye Bluetooth).

---

## Running locally

Just open `public/index.html` in a browser (or serve the folder from VS Code). The pages call the live API on Pantheon directly, so you'll see the same data as the deployed site. If you want to test `RWS.py` on a Mac:

```bash
python RWS.py
```

It'll run in simulation mode automatically.

---

## Deploying

The site is a folder (`rws-lite/`) inside the engin-rws Pantheon repo. Copy changed files there, commit, and `git push origin master` — Pantheon's Dev environment picks it up automatically. Promote Dev → Test → Live from the Pantheon dashboard when ready.
