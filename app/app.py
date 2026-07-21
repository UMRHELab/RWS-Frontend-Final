from flask import Flask, jsonify, render_template
import sqlite3
import os

app = Flask(__name__, static_folder='../styles', static_url_path='/styles', template_folder='../public')

@app.route('/styles/styles.css')
@app.route('/public/styles/styles.css')
def serve_styles():
    return app.send_static_file('styles.css')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, '../data/sensorData.db'))


def get_latest_data():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1").fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        print(f"Database read error: {e}")
        return None


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/cs-facility')
def cs_facility():
    return render_template('cs-facility.html')

@app.route('/rm1962')
def rm1962():
    return render_template('rm1962.html')

@app.route('/basement')
def basement():
    return render_template('basement.html')

@app.route('/api/live-data')
def live_data():
    data = get_latest_data()
    if data:
        return jsonify({"status": "online", "data": data})
    return jsonify({
        "status": "offline",
        "data": {
            "id": 0, "pi_num": 0, "timestamp": 0.0, 
            "temp": 0.0, "humidity": 0.0, "pressure": 0.0,
            "gas": 0.0, "soil_moisture": 0.0, "soil_temperature": 0.0,
            "wind_speed": 0.0, "wind_direction": 0.0, "rainfall": 0.0,
            "radon_level": 0.0, "geiger_cpm": 0.0, "UV": 0.0,
            "lux": 0.0
        }
    })

@app.route('/api/insert-sample', methods=['POST'])
def insert_sample():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sensor_data (pi_num, timestamp, temp, humidity, pressure,
            gas, soil_moisture, soil_temperature, wind_speed, wind_direction, rainfall,
            radon_level, geiger_cpm, UV, lux)
            VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        ''')
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Sample insert error: {e}")
        return jsonify({"status": "error"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
