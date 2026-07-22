<?php
header('Content-Type: application/json'); // JSON response
// CORS: allow the dashboard JS to call this file from the browser without being blocked.
header('Access-Control-Allow-Origin: *');

// ---------------------------------------------------------------------------
// MiServer (webapps3) connection details.
// NOTE: webapps3-db is only reachable if THIS php file is hosted on the
// webapps3 web space. It is NOT reachable from Pantheon. If the dashboard is
// served from Pantheon, point these at webapps2-db / rws_data instead.
// ---------------------------------------------------------------------------
$DB_HOST = 'webapps3-db.miserver.it.umich.edu';
$DB_NAME = 'rws_data_test';
$DB_USER = 'rws_data_test';
$DB_PASS = '7N22Mn5V_y';

// The test DB is a single combined table (no per-station tables), so the
// ?station= param is accepted but every station reads the same latest row.
$station = $_GET['station'] ?? null;

try {
    // Open the connection. mysql = driver, host = MiServer, dbname = which
    // database to open, charset = standard unicode text encoding.
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Pull the newest reading from the single RWSLite_data table and alias the
    // raw columns to the field names the dashboard JS expects.
    //
    // TEMPERATURE UNITS: the Pi sensors report Celsius, and the dashboard shows
    // Fahrenheit, so temp / soil_temperature are converted here (* 9/5 + 32).
    // >>> If a real row shows temps that look wrong (e.g. 22 instead of 72),
    //     the column is already Fahrenheit — remove the conversion.
    //
    // RADIATION vs RADON: the table has both. geiger_cpm (gamma counts) feeds
    // the "Radiation" chart; radon_level (pCi/L) feeds the radon displays and,
    // aliased as radon_pci_l, the homepage Radiation card with EPA thresholds.
    $stmt = $pdo->query("
        SELECT
            id,
            pi_num,
            timestamp,
            (temp * 9/5 + 32)             AS indoor_temp,
            humidity                      AS indoor_humidity,
            pressure                      AS indoor_pressure,
            gas                           AS indoor_gas,
            soil_moisture                 AS soil_moisture,
            (soil_temperature * 9/5 + 32) AS soil_temperature,
            wind_speed                    AS wind_speed,
            wind_direction                AS wind_direction,
            rainfall                      AS rainfall,
            radon_level                   AS radon_level,
            radon_level                   AS radon_pci_l,
            geiger_cpm                    AS radiation,
            UV                            AS uv,
            lux                           AS lux
        FROM RWSLite_data
        ORDER BY timestamp DESC
        LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // { "data": {...} } on success, { "data": null } if the table is empty.
    // station-manager.js / dashboard.js fall back to placeholder data when
    // data is null or the request errors.
    echo json_encode(['data' => $row ?: null]);

} catch (PDOException $e) {
    // On any connection/query failure return a 500 with the message so the
    // dashboard knows to fall back, and so you can see the reason in the
    // raw live-data.php response while debugging.
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
