# RWS Lite Project Log, July 3, 2026

## What got done today

* Deployed the new RWS Lite dashboard to the Pantheon site. It now lives at
  `/rws-lite/` alongside the existing WordPress site, with a footer menu
  linking the two
* Moved the site's data source over to the production database (webapps2) and
  imported the RAD8 radon and roof station tables that were stranded in the
  test DB
* The Radiation Level card now shows the real RAD8 radon reading (77.4 pCi/L)
  with correct units, and color codes green, orange, or red based on EPA
  thresholds
* Cleaned out all the fake placeholder data: no more random numbers when a
  sensor is unreachable, no more hardcoded "Sunny / 71°F" forecast, no more
  fake "NORMAL" badges
* Station badges and sidebar icons now show ONLINE or OFFLINE automatically
  based on how fresh the data actually is, and each station page shows a
  "Last reading" date so stale data is obvious
* Recent Highlights and News & Updates on the homepage now pull live from
  shared Google Sheets. Anyone on the team can post an update by adding a row,
  no code needed
* Fixed the mobile layout: hamburger menu, single column stacking, and the
  header and footer no longer get squished. Also scaled up text on large
  monitors
* Moved the repo to the UMRHELab GitHub org

## What still needs to happen

* Revive the data pipelines. All three stations stopped pushing (Rm 1962 in
  Oct 2023, roof in Mar 2026, and RAD8's last data is May 2026). See the
  stations guide for the checklist. The key point is that new rows must land
  in `rws_data` on webapps2
* Deploy Dev to Test to Live in Pantheon once we're happy with the dev site.
  Nothing is public until then
* Org admin: delete the duplicate public repo on GitHub (the old one ending in
  a dash)
* Ask ITS to rotate the database password since it was exposed in a public
  repo, and ideally get credentials out of the code afterward
* Optional polish: real Ann Arbor weather for the homepage banner, and
  confirming the basement station's table exists on webapps2
