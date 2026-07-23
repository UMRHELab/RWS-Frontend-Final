<?php
header('Content-Type: application/json'); // json response
// enable CORS for Dashboard api requests.
header('Access-Control-Allow-Origin: *');

// database connection: webapps2 / rws_data (RWSLite_data imported here).
// webapps2-db is reachable from Pantheon, so the Live site can use this.
$DB_HOST = 'webapps2-db.miserver.it.umich.edu';
$DB_NAME = 'rws_data';
$DB_USER = 'rws_data';
$DB_PASS = 'Im Radioactive#1';

// The test database uses one shared table instead of separate station tables.
// the station parameter is kept for compatibility, but all Stations currently
// return the same latest reading
$station = $_GET['station'] ?? null;

try {
    // open the connection. mysql = driver, host = MiServer, dbname = which
    // database to open, charset = standard Unicode text encoding
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // get the latest RWSLite_data reading and map the Database fields
    // to the names used by the dashboard.
    // temperature values from the Pi sensors are stored in celsius and
    // converted to Fahrenheit here for display. if the readings look off,
    // check whether the database values are already in fahrenheit.
    // The table stores both radiation and radon data. geiger_cpm is used
    // for the radiation chart, while radon_level (pCi/L) is used for the
    // Radon displays and the homepage radiation card
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

    // returns the latest reading as { data: {...} }.
    // if no records exist, returns { data: null }
    // The dashboard scripts use placeholder data when the response is empty
    // or the request encounters an error
    echo json_encode(['data' => $row ?: null]);

} catch (PDOException $e) {
    // return errors to trigger Dashboard
    // fallback data and help with debugging
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
