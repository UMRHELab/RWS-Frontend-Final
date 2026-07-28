// Station page configuration and shared variables
// Load order: config -> charts -> data -> page
// Uses global variables instead of modules
// Shared application state
// history stores sensor data used for charts and reports
// instances stores active Chart.js chart instances
let history = {
    radon: [],
    temperature: [],
    moisture: [],
    soiltemp: [],
    wind: [],
    rainfall: [],
    solar: [],
    humidity: [],
    pressure: []
};
let instances = {};
let activeMetric = null;
let currentStation = 'unknown';
let lastSensorTs = null;
const MAX_PTS = 30;
const HISTORY_INTERVAL_MS = 10 * 60 * 1000;
let lastHistoryLogTime = 0;
// True once the charts have been pre-filled from a data source's own history
// (used when a sensor has gone quiet and would otherwise show one flat point)
let historySeeded = false;
// Display a formatted number value
// Shows "--" when the value is unavailable
function setReal(id, v, dec, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (v == null || isNaN(Number(v)))
        ? '--'
        : Number(v).toFixed(dec) + (suffix || '');
}
// Update text content if the element exists
function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
}
// Station-specific configuration
// Each station defines its page information, charts, sensors, and display values.
// Shared functions use this configuration to render each station page.
const STATIONS_CONFIG = {
    'basement': {
        filenamePrefix: 'RWS_Basement',
        page: {
            title: 'Basement Aux Station - RWS',
            heroClass: 'basement-hero',
            h1: 'Basement Aux Station',
            subtitle: 'Sub-Level Monitoring · Radon & Environmental Data',
            caption: 'University of Michigan North Campus, tracking indoor radiation and soil conditions.',
            dbCode: 'sensor_basement',
            location: 'Sub-level Basement',
            instruments: 'AlphaGUARD, RadonEye, Pylon AB-5',
        },
        csvHeaders: [
            'Timestamp',
            'Radon (pCi/L)',
            'Temp (°F)',
            'Soil Moisture (%)',
            'Soil Temp (°F)'
        ],
        metrics: {
            radon: {
                canvas: 'radonChart',
                color: '--station-basement-radon',
                label: 'Radon Level',
                dec: 2,
                unit: ' pCi/L',
                avgId: 'avg-radon'
            },
            temperature: {
                canvas: 'tempChart',
                color: '--station-basement-temperature',
                label: 'Temperature',
                dec: 1,
                unit: '°F',
                avgId: 'avg-temp'
            },
            moisture: {
                canvas: 'moistureChart',
                color: '--station-basement-moisture',
                label: 'Soil Moisture',
                dec: 1,
                unit: '%',
                avgId: 'avg-moisture'
            },
            soiltemp: {
                canvas: 'soiltempChart',
                color: '--station-basement-soiltemp',
                label: 'Soil Temperature',
                dec: 1,
                unit: '°F',
                avgId: 'avg-soiltemp'
            }
        },
        updateUI: (sensor) => {
            // weather-temp is NOT set here -- it's Ann Arbor's real outdoor temperature
            // from a public weather API (see footer.js), not this station's own sensor
            setReal('nav-temp', sensor.indoor_temp, 0, '°F');
            setReal('current-radon', sensor.radon_level, 2);
            setReal('radon-card-val', sensor.radon_level, 2, ' pCi/L');
            setReal('current-temp', sensor.indoor_temp, 1);
            setReal('current-moisture', sensor.soil_moisture, 1);
            setReal('current-soiltemp', sensor.soil_temperature, 1);
            return {
                radon: sensor.radon_level,
                temperature: sensor.indoor_temp,
                moisture: sensor.soil_moisture,
                soiltemp: sensor.soil_temperature
            };
        }
    },
    'cs-facility': {
        filenamePrefix: 'RWS_CSFacility',
        page: {
            title: 'CS Facility Auxiliary Station - RWS',
            heroClass: 'cs-hero',
            h1: 'CS Facility Auxiliary Station',
            subtitle: 'Roof Level Monitoring · Weather & Environmental Data',
            caption: 'University of Michigan North Campus, tracking weather conditions and environmental changes.',
            dbCode: 'sensor_roof',
            location: 'Roof Level',
            instruments: 'CR1000 Datalogger',
        },
        csvHeaders: [
            'Timestamp',
            'Temp (°F)',
            'Wind (mph)',
            'Rainfall (in)',
            'Solar (lx)'
        ],
        metrics: {
            temperature: {
                canvas: 'tempChart',
                color: '--station-cs-facility-temperature',
                label: 'Temperature',
                dec: 1,
                unit: '°F',
                avgId: 'avg-temp'
            },
            wind: {
                canvas: 'windChart',
                color: '--station-cs-facility-wind',
                label: 'Wind Speed',
                dec: 1,
                unit: ' mph',
                avgId: 'avg-wind'
            },
            rainfall: {
                canvas: 'rainChart',
                color: '--station-cs-facility-rainfall',
                label: 'Rainfall',
                dec: 3,
                unit: ' in',
                avgId: 'avg-rain'
            },
            solar: {
                canvas: 'solarChart',
                color: '--station-cs-facility-solar',
                label: 'Solar Radiation',
                dec: 0,
                unit: ' lx',
                avgId: 'avg-solar'
            }
        },
        updateUI: (sensor) => {
            // weather-temp is NOT set here -- it's Ann Arbor's real outdoor temperature
            // from a public weather API (see footer.js), not this station's own sensor
            setReal('nav-temp', sensor.indoor_temp, 0, '°F');
            setReal('current-temp', sensor.indoor_temp, 1);
            setReal('current-wind', sensor.wind_speed, 1);
            setReal('current-rain', sensor.rainfall, 3);
            setReal('current-solar', sensor.lux, 0);
            return {
                temperature: sensor.indoor_temp,
                wind: sensor.wind_speed,
                rainfall: sensor.rainfall,
                solar: sensor.lux
            };
        }
    },
    'rm1962': {
        filenamePrefix: 'RWS_RM1962',
        page: {
            title: 'RM 1962 Auxiliary Station - RWS',
            heroClass: 'rm1962-hero',
            h1: 'RM 1962 Auxiliary Station',
            subtitle: 'Indoor Lab Monitoring · Radiation & Environmental Data',
            caption: 'University of Michigan, tracking indoor radiation levels and environmental conditions in the lab.',
            dbCode: 'sensor_rm1962',
            location: 'Room 1962, Indoor',
            instruments: 'BME680, DIYgm, RAD8',
        },
        csvHeaders: [
            'Timestamp',
            'Temp (°F)',
            'Humidity (%)',
            'Radon (pCi/L)',
            'Pressure (hPa)'
        ],
        metrics: {
            temperature: {
                canvas: 'tempChart',
                color: '--station-rm1962-temperature',
                label: 'Temperature',
                dec: 1,
                unit: '°F',
                avgId: 'avg-temp'
            },
            humidity: {
                canvas: 'humidityChart',
                color: '--station-rm1962-humidity',
                label: 'Humidity',
                dec: 1,
                unit: '%',
                avgId: 'avg-humidity'
            },
            // RAD8 reports radon levels in pCi/L
            radon: {
                canvas: 'radonChart',
                color: '--station-rm1962-radon',
                label: 'Radon Level',
                dec: 2,
                unit: ' pCi/L',
                avgId: 'avg-radon'
            },
            pressure: {
                canvas: 'pressureChart',
                color: '--station-rm1962-pressure',
                label: 'Air Pressure',
                dec: 1,
                unit: ' hPa',
                avgId: 'avg-pressure'
            }
        },
        updateUI: (sensor) => {
            // weather-temp is NOT set here -- it's Ann Arbor's real outdoor temperature
            // from a public weather API (see footer.js), not this station's own sensor
            setReal('nav-temp', sensor.indoor_temp, 0, '°F');
            setReal('current-temp', sensor.indoor_temp, 1);
            setReal('current-humidity', sensor.indoor_humidity, 1);
            setReal('current-radon', sensor.radon_level, 2);
            setReal('current-pressure', sensor.indoor_pressure, 1);
            return {
                temperature: sensor.indoor_temp,
                humidity: sensor.indoor_humidity,
                radon: sensor.radon_level,
                pressure: sensor.indoor_pressure
            };
        }
    }
};
