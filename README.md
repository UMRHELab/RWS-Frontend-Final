# RWS

shows live readings from 3 spots: CS Facility roof, Room 1962, and the basement. no react, no build step

---

## how it works 

basically every station's hardware (RAD8, BME680, that CR1000 datalogger thing, etc) logs a reading every ~10 min. `live-data.php` grabs the latest one and hands it back as JSON — it tries the campus mysql db first, and if that's not reachable it falls back to a dropbox csv that gets synced from the lab computer (RAD8 and room 1962 data mainly). the dashboard js just polls that endpoint once a minute and shovels the numbers into the cards/charts/badges.

```
instruments  →  campus DB / dropbox csv  →  live-data.php  →  dashboard js (polls every 60s)
```

if a station doesn't answer you just get `--` and a gap in the chart instead of some made up number, we're not trying to lie to anyone. it'll also keep showing the last good reading for like 15 min before it actually flips the badge to OFFLINE, so one bad poll doesn't nuke the whole page.

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
