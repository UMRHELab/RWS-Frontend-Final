# Bringing a Station Back Online

The RWS Lite dashboard (https://dev-engin-rws.pantheonsite.io/rws-lite/) marks a
station **ONLINE** when its newest database row is **less than 1 hour old**, and
**OFFLINE** otherwise. Nothing needs to be changed on the website to bring a
station back — you only need to get fresh rows flowing into the right table.

## Where the website reads from

Database: `rws_data` on **webapps2-db.miserver.it.umich.edu** (MySQL).
One table per station:

| Station (dashboard name)    | Table         | Last real reading |
|-----------------------------|---------------|-------------------|
| CS Facility Aux (roof)      | `roof_data`   | March 14, 2026    |
| Room 1962 Aux               | `RC_RWS_Lite` | October 1, 2023   |
| Basement Aux                | `basement_data` | (check)         |
| RAD8 radon monitor          | `rad8_data`   | May 28, 2026      |

**Important:** some pipelines were writing to `rws_data_test` on
**webapps3-db** (a test database). The website cannot reach webapps3 — anything
still pointed there must be switched to `rws_data` on **webapps2**.

## How the data is supposed to flow

```
sensors → Raspberry Pi (RWS.py → local SQLite: data/sensorData.db)
        → sync/upload step (Dropbox / sync scripts / cron)
        → MySQL rws_data @ webapps2  ← the website reads from here
```

A station goes dark when any link breaks: the Pi is off or crashed, the sensor
script stopped, the sync step stopped running, or it uploads to the wrong
database/table.

## Checklist to revive a station

1. **Pi alive?** Power, network, can you SSH in.
2. **Sensor script running?** `RWS.py` (or the station's equivalent) should be
   running on boot — check its logs and that new rows appear in the local
   SQLite file (`data/sensorData.db`).
3. **Sync step running?** Whatever carries data off the Pi (Dropbox upload,
   cron job, sync script) must be active. This is the most commonly broken link.
4. **Right destination?** The final insert must land in `rws_data` on
   **webapps2**-db.miserver.it.umich.edu, in the table listed above — not in
   `rws_data_test` on webapps3.
5. **Column names match?** Check an existing row in phpMyAdmin and make sure
   the upload writes the same columns (e.g. `roof_data` expects `AirTC`,
   `WS_ms`, `Rain_mm`, `SlrkW_Avg`, `RH`, `BP_mbar`, `timestamp`).

## How to verify it worked

1. phpMyAdmin → webapps2-db → `rws_data` → the station's table → newest row
   should have a timestamp from the last few minutes.
2. Open `https://dev-engin-rws.pantheonsite.io/live-data.php?station=cs-facility`
   (or `rm1962` / `basement` / `rad8`) — the JSON should show that new timestamp.
3. Refresh the dashboard: the station's badge flips to green **ONLINE**
   automatically, and its charts and "Last reading" stamp update. No website
   changes needed.

## Notes

- The dashboard never invents data anymore: what you see is the newest real
  row, with a "Last reading" date stamp on each station page.
- The 1-hour online window is set in `public/js/dashboard.js`
  (`ONLINE_MAX_AGE_MS`) if the reporting cadence ever changes.
- Questions about database access/firewall: the site's PHP connects from
  Pantheon's servers, which can only reach webapps2 (webapps3 is blocked).
