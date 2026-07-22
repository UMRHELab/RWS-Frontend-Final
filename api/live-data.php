<?php
header('Content-Type: application/json'); // JSON response
// CORS: allow the dashboard JS to call this file from the browser without being blocked.
header('Access-Control-Allow-Origin: *');

// Database connection: webapps2 / rws_data (RWSLite_data imported here).
// webapps2-db IS reachable from Pantheon, so the live site can use this.
$DB_HOST = 'webapps2-db.miserver.it.umich.edu';
$DB_NAME = 'rws_data';
$DB_USER = 'rws_data';   
$DB_PASS = 'Im Radioactive#1';  

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

    // Get the latest reading from the RWSLite_data table and rename the database
    // fields to match the names expected by the dashboard JavaScript.
    //
    // TEMPERATURE UNITS:
    // The Pi sensors store temperature values in Celsius, but the dashboard
    // displays Fahrenheit. The conversion is handled here (C * 9/5 + 32).
    // If the displayed values look incorrect (for example, 22 instead of 72),
    // check whether the database is already storing Fahrenheit and remove this
    // conversion if needed.
    //
    // RADIATION VS RADON:
    // The database contains both radiation and radon measurements.
    // geiger_cpm represents gamma radiation counts and is used for the
    // "Radiation" chart, while radon_level (pCi/L) is used for radon displays.
    // radon_level is also mapped to radon_pci_l for the homepage Radiation card,
    // which uses EPA radon threshold values.
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

    // Returns the latest reading as { data: {...} }.
    // If no records exist, returns { data: null }.
    // The dashboard scripts use placeholder data when the response is empty
    // or the request encounters an error.
    echo json_encode(['data' => $row ?: null]);

} catch (PDOException $e) {
    // Return a 500 error for connection or query failures.
    // The dashboard will use fallback data, while the error message in the
    // live-data.php response helps with debugging.
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
