<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// where the data comes from:
// every station (cs-facility, basement, rm1962, rad8) reads from the campus
// mysql db (webapps3-db). that db is firewalled to the UM campus network, so
// pantheon can't reach it -- every request from the deployed site just gets
// null quickly until UM opens that connection, or this runs on a campus
// machine. no more dropbox fallback -- it kept reverting to private, and the
// team decided to stop relying on it and focus on the db connection instead.

$DB_HOST = 'webapps3-db.miserver.it.umich.edu';
$DB_NAME = 'rws_data_test';
$DB_USER = 'rws_data_test';
$DB_PASS = '7N22Mn5V_y';

$station = 'cs-facility';
if (isset($_GET['station'])) {
    $station = $_GET['station'];
}

// on pantheon the db is never gonna connect anyway, so skip the 3 second
if (getenv('PANTHEON_ENVIRONMENT')) {
    echo json_encode(fallback_for_station($station, 'db not reachable from Pantheon'));
    exit;
}

// stations that pull from the database (only works from inside the UM network)
try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3, // give up after 3s instead of hanging forever
        ]
    );

    $row = null;

    if ($station === 'cs-facility') {
        // CR1000_data (sensor_id 20) is the rooftop CR1000's current table --
        $stmt = $pdo->query("
            SELECT
                timestamp,
                (AirTemp * 9/5 + 32)       AS indoor_temp,
                (WindVel * 2.237)           AS wind_speed,
                (RainTotal * 0.03937)       AS rainfall,
                (SlrIrrkW_Avg * 120000)     AS lux,
                RelHum                      AS indoor_humidity,
                BPressure                   AS indoor_pressure
            FROM CR1000_data
            WHERE sensor_id = 20
            ORDER BY timestamp DESC
            LIMIT 1
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && is_stale($row['timestamp'], 30)) {
            echo json_encode(['data' => cs_facility_static_snapshot(), 'note' => 'db data is over 30 days old']);
            exit;
        }

    } elseif ($station === 'basement') {
        // CR1000X_data (sensor_id 3) is the basement soil probe's current table --
        // basement_data stopped updating in 2018, this one is live. VWC_GS3 reads a
        // constant 0 (that probe looks dead), so only VWC_GS1 is used for soil_moisture.
        $stmt = $pdo->query("
            SELECT
                timestamp,
                (AirTC * 9/5 + 32)         AS indoor_temp,
                RH                          AS indoor_humidity,
                BP_mbar                     AS indoor_pressure,
                NULL                        AS radon_level,
                (VWC_GS1 * 100)             AS soil_moisture,
                (SoilTemp * 9/5 + 32)       AS soil_temperature
            FROM CR1000X_data
            WHERE sensor_id = 3
            ORDER BY timestamp DESC
            LIMIT 1
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && is_stale($row['timestamp'], 30)) {
            echo json_encode(['data' => null, 'note' => 'db data is over 30 days old']);
            exit;
        }

    } elseif ($station === 'rm1962') {
        // RC_RWS_Lite is gone from this db, RWSLite_data replaced it
        // (it just mirrors the pi's own sqlite table now, see RWS.py)
        $stmt = $pdo->query("
            SELECT
                timestamp,
                (temp * 9/5 + 32)           AS indoor_temp,
                humidity                     AS indoor_humidity,
                pressure                     AS indoor_pressure,
                (geiger_cpm * 5)             AS radiation,
                radon_level                  AS radon_level,
                soil_moisture                AS soil_moisture,
                (soil_temperature * 9/5 + 32) AS soil_temperature,
                wind_speed                   AS wind_speed,
                lux                          AS lux
            FROM RWSLite_data
            WHERE pi_num = 1
            ORDER BY timestamp DESC
            LIMIT 1
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && is_stale($row['timestamp'], 30)) {
            $row = rwslite_stale_history($pdo);
        }

    } elseif ($station === 'rad8') {
        // rad8_data on webapps3 -- NOTE: this query is a best guess based on an
        // old, unfinished draft (it still had placeholder CHANGE_ME credentials,
        // so it was never actually tested against the real table). That draft
        // never had a radon concentration column at all, so radon_pci_l is left
        // null below -- someone needs to check the real column list in
        // phpMyAdmin and fill that in before this is trustworthy.
        $stmt = $pdo->query("
            SELECT
                timestamp,
                counts_per_min,
                (ambient_temp * 9/5 + 32)    AS ambient_temp_f,
                (sample_temp_cal * 9/5 + 32) AS sample_temp_f,
                relative_humidity,
                baro_pressure_mbar
            FROM rad8_data
            ORDER BY timestamp DESC
            LIMIT 1
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $row['radon_pci_l'] = null; // TODO: confirm the real column name
        }
    }

    if ($row === false) {
        $row = null;
    }
    echo json_encode(['data' => $row]);

} catch (PDOException $e) {
    echo json_encode(fallback_for_station($station, 'db unreachable'));
}

// Used whenever a station's live source is unavailable -- either Pantheon can
// never reach the campus db, or a real db connection attempt just failed.
// cs-facility has a local file to fall back on; every other station now
// reads from the same campus db, so there's nothing left to substitute --
// they just show unavailable instead of a blank page.
function fallback_for_station($station, $reason)
{
    if ($station === 'cs-facility') {
        return ['data' => cs_facility_static_snapshot(), 'note' => "$reason; showing rooftop snapshot from 2023-11-13"];
    }
    return ['data' => null, 'note' => $reason];
}

// the rooftop CR1000 datalogger's last 20 readings, read straight from its own
// export file (loggernet/CR1000_Rooftop.dat, checked into the repo) file stopped 
// getting new data on 2023-11-13, so this is a fixed historical snapshot, 
// not live. CR1000_data in
// the database IS live (see the cs-facility query above), but pantheon can never
// reach the database at all, so this is still the only thing that works from the
// deployed site.
function cs_facility_static_snapshot()
{
    $path = __DIR__ . '/loggernet/CR1000_Rooftop.dat';
    $lines = read_last_lines($path, 20);

    $history = [];
    foreach ($lines as $line) {
        $values = str_getcsv($line);
        if (count($values) < 13) continue;
        $history[] = map_rooftop_row($values);
    }
    if (!$history) return null;

    $data = $history[count($history) - 1];
    $data['history'] = $history;
    $data['source'] = 'roof-static-snapshot';
    return $data;
}

// Maps one row (by column position) from CR1000_Rooftop.dat. Columns:
// TIMESTAMP, RECORD, BattV, PTemp_C, Rain_mm_2_Tot, SlrkW_Avg, WindDir,
// WS_ms, AirTC, RH, BP_mbar, Rain_mm, HAmount
function map_rooftop_row($values)
{
    // cs_facility_static_snapshot() already checked count($values) >= 13
    // before calling this, so every index below is guaranteed to exist
    $airTempC = num_or_null($values[8]);
    $windMs   = num_or_null($values[7]);
    $rainMm   = num_or_null($values[11]);
    $slrKw    = num_or_null($values[5]);

    $indoorTemp = null;
    if ($airTempC !== null) {
        $indoorTemp = round($airTempC * 9 / 5 + 32, 2);
    }

    $windSpeed = null;
    if ($windMs !== null) {
        $windSpeed = round($windMs * 2.237, 2);
    }

    $rainfall = null;
    if ($rainMm !== null) {
        $rainfall = round($rainMm * 0.03937, 4);
    }

    $lux = null;
    if ($slrKw !== null) {
        $lux = round($slrKw * 120000, 1);
    }

    return [
        'timestamp'       => $values[0],
        'indoor_temp'     => $indoorTemp,
        'wind_speed'      => $windSpeed,
        'rainfall'        => $rainfall,
        'lux'             => $lux,
        'indoor_humidity' => num_or_null($values[9]),
        'indoor_pressure' => num_or_null($values[10]),
    ];
}

// Reads just the last $count lines of a file without loading the whole thing
// into memory -- CR1000_Rooftop.dat is 25MB and we only need the last 20 lines
function read_last_lines($path, $count)
{
    if (!file_exists($path)) return [];

    $fp = fopen($path, 'r');
    if (!$fp) return [];

    $chunkSize = 8192; // bytes -- plenty of room for the last 20 lines
    $fileSize = filesize($path);
    $seekStart = max(0, $fileSize - $chunkSize);

    fseek($fp, $seekStart);
    $chunk = fread($fp, $chunkSize);
    fclose($fp);

    $lines = preg_split("/\r\n|\n|\r/", trim($chunk));
    return array_slice($lines, -$count);
}

// RWSLite_data has gone stale (nobody's updated it in 30+ days). Instead of
// substituting a different instrument's live reading under rm1962's name, show
// rm1962's own last 20 real readings so the chart is still honest, even though
// it's not current. The frontend shows a "not updating yet" label whenever
// this is the source (source: 'rwslite-stale').
function rwslite_stale_history($pdo)
{
    $stmt = $pdo->query("
        SELECT
            timestamp,
            (temp * 9/5 + 32)           AS indoor_temp,
            humidity                     AS indoor_humidity,
            pressure                     AS indoor_pressure,
            (geiger_cpm * 5)             AS radiation,
            radon_level                  AS radon_level,
            soil_moisture                AS soil_moisture,
            (soil_temperature * 9/5 + 32) AS soil_temperature,
            wind_speed                   AS wind_speed,
            lux                          AS lux
        FROM RWSLite_data
        WHERE pi_num = 1
        ORDER BY timestamp DESC
        LIMIT 20
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) return null;

    $history = array_reverse($rows);
    $data = $history[count($history) - 1];
    $data['history'] = $history;
    $data['source'] = 'rwslite-stale';
    return $data;
}

// True if a db row's timestamp is older than $maxDays -- so a query that
// technically succeeds against a table nobody's updated in months doesn't
// get shown as if it were a live reading
function is_stale($timestamp, $maxDays)
{
    $rowTime = strtotime($timestamp);
    if ($rowTime === false) return true;
    $ageDays = (time() - $rowTime) / 86400;
    return $ageDays > $maxDays;
}

function num_or_null($v)
{
    if ($v === null || $v === '' || !is_numeric($v)) {
        return null;
    }
    return (float) $v;
}

