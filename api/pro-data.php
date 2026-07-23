<?php
header('Content-Type: application/json'); // Sending back json
// so the Dashboard pages can actually call this without CORS complaining
header('Access-Control-Allow-Origin: *');

// Same DB as live-data.php, but Pro sensors have one table per measurement
// instead of one shared table
$DB_HOST = 'webapps2-db.miserver.it.umich.edu';
$DB_NAME = 'rws_data';
$DB_USER = 'rws_data';
$DB_PASS = 'Im Radioactive#1';

// Whitelist of tables people are allowed to ask for. the name comes straight
// from the URL so without this someone could just type in any Table name
$allowed_tables = [
    'DoseRate', 'AirTemp', 'EnclosureTemp', 'BarometricPressure',
    'WindSpeed', 'WindDir', 'SolarRad', 'Rain', 'RainRunningTotal',
    'RelativeHumidity', 'RadonEye', 'SwordSpectrum', 'Rad7',
];

$limit = 500; // How many of the most recent readings to grab per table

// grabs the last $limit rows from one table and flips them to oldest-first
// So the charts draw left to right. x/y is just what chart.js wants to see
function get_readings($pdo, $table, $limit) {
    // stable already got checked against the whitelist above
    $query = "SELECT Recorded, Data FROM `$table` ORDER BY Recorded DESC LIMIT :limit";
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rows = array_reverse($rows);

    $readings = [];
    foreach ($rows as $row) {
        $readings[] = [
            'x' => $row['Recorded'],
            'y' => $row['Data'],
        ];
    }
    return $readings;
}

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Just one table -> ?table=AirTemp gives you { data: [...] }
    // need Two together (like the combined temp/rain panels)? use
    // ?tables=AirTemp,EnclosureTemp and you get { AirTemp: [...], EnclosureTemp: [...] }
    if (isset($_GET['tables'])) {
        $table_names = explode(',', $_GET['tables']);
        $response = [];

        foreach ($table_names as $name) {
            $name = trim($name);

            if (!in_array($name, $allowed_tables)) {
                http_response_code(400);
                echo json_encode(['error' => "Unknown table: $name"]);
                exit;
            }

            $response[$name] = get_readings($pdo, $name, $limit);
        }

        echo json_encode($response);

    } elseif (isset($_GET['table'])) {
        $name = trim($_GET['table']);

        if (!in_array($name, $allowed_tables)) {
            http_response_code(400);
            echo json_encode(['error' => "Unknown table: $name"]);
            exit;
        }

        echo json_encode(['data' => get_readings($pdo, $name, $limit)]);

    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Missing table or tables parameter']);
    }

} catch (PDOException $e) {
    // If the db connection or query blows up, send the error back instead of
    // just leaving a blank page. Makes it way easier to see what Broke
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
