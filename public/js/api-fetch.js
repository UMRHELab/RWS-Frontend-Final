const API_BASE = 'http://127.0.0.1:5000/api'; // Steven's flask server

// grabs whatever json object the api sends back
async function getJSON(path) {
    const response = await fetch(API_BASE + path);
    return await response.json();
}

// fills up a dropdown with options and turns it back on so it can be clicked
function fillSelect(id, items) {
    const select = document.getElementById(id);
    select.innerHTML = '';
    for (const item of items) {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    }
    select.disabled = false;
}

// keeps track of the chart currently on screen, so we can get rid of it
// before drawing a new one - Chart.js won't let two charts share one canvas
let currentChart = null;

// draws the data on the chart - timestamps on the x-axis, values on the y-axis
function drawChart(timestamps, values) {
    if (currentChart) {
        currentChart.destroy();
    }
    currentChart = new Chart(document.getElementById('explorer-chart'), {
        type: 'line',
        data: { labels: timestamps, datasets: [{ data: values }] }
    });
}

// runs when you pick a building
async function onBuildingChange() {
    const building = document.getElementById('building').value;
    const result = await getJSON('/rooms?building_name=' + encodeURIComponent(building));
    fillSelect('room', result.rooms);
}

// runs when you pick a room
async function onRoomChange() {
    const building = document.getElementById('building').value;
    const room = document.getElementById('room').value;
    const path = '/sensors?building_name=' + encodeURIComponent(building) + '&room_number=' + encodeURIComponent(room);
    const result = await getJSON(path);
    fillSelect('sensor', result.sensors);
}

// runs when you pick a sensor
async function onSensorChange() {
    const sensor = document.getElementById('sensor').value;
    const result = await getJSON('/sensor-columns?sensor_type=' + encodeURIComponent(sensor));
    fillSelect('metric', result.columns);
}

// runs when you hit the get data button
async function onSubmit() {
    const building = document.getElementById('building').value;
    const room = document.getElementById('room').value;
    const sensor = document.getElementById('sensor').value;
    const metric = document.getElementById('metric').value;
    const path = '/sensor-data?building_name=' + encodeURIComponent(building) +
        '&room_number=' + encodeURIComponent(room) +
        '&sensor=' + encodeURIComponent(sensor) +
        '&data_column=' + encodeURIComponent(metric);
    const result = await getJSON(path);
    drawChart(result.data.timestamps, result.data.values);
}
