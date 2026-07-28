<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// where the data comes from:
// every station (cs-facility, basement, rm1962, rad8) reads from the campus
// mysql db (webapps3-db). that db is firewalled to the UM campus network, so
// pantheon can't reach it - every request from the deployed site just gets
// null quickly until UM opens that connection, or this runs on a campus
// machine. no dropbox fallback, no local-file fallback - just webapps3.

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
    echo json_encode(fallback_for_station('db not reachable from Pantheon'));
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
        // CR1000_data (sensor_id 20) is the rooftop CR1000's current table
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
            echo json_encode(['data' => null, 'note' => 'db data is over 30 days old']);
            exit;
        }

    } elseif ($station === 'basement') {
        // CR1000X_data (sensor_id 3) is the basement soil probe's current table
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
        // rad8_data on webapps3 - NOTE: this query is a best guess based on an
        // old, unfinished draft (it still had placeholder CHANGE_ME credentials,
        // so it was never actually tested against the real table). That draft
        // never had a radon concentration column at all, so radon_pci_l is left
        // null below - someone needs to check the real column list in
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
    echo json_encode(fallback_for_station('db unreachable'));
}

// Used whenever a station's live source is unavailable - either Pantheon can
// never reach the campus db, or a real db connection attempt just failed.
// every station reads from the same campus db now, so there's nothing left
// to substitute - they just show unavailable instead of a blank page.
function fallback_for_station($reason)
{
    return ['data' => null, 'note' => $reason];
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

// True if a db row's timestamp is older than $maxDays - so a query that
// technically succeeds against a table nobody's updated in months doesn't
// get shown as if it were a live reading
function is_stale($timestamp, $maxDays)
{
    $rowTime = strtotime($timestamp);
    if ($rowTime === false) return true;
    $ageDays = (time() - $rowTime) / 86400;
    return $ageDays > $maxDays;
}

