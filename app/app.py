from flask import Flask, jsonify, render_template, redirect
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

@app.route('/station.html')
def station():
    return render_template('station.html')

@app.route('/cs-facility')
def cs_facility():
    return redirect('/station.html?station=cs-facility')

@app.route('/rm1962')
def rm1962():
    return redirect('/station.html?station=rm1962')

@app.route('/basement')
def basement():
    return redirect('/station.html?station=basement')

@app.route('/api/live-data')
def live_data():
    data = get_latest_data()
    if data:
        return jsonify({"status": "online", "data": data})
    return jsonify({"status": "offline", "data": None})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
