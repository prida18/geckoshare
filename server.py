from flask import Flask, request, render_template, send_from_directory, redirect, url_for, send_file
from flask_socketio import SocketIO, emit
import os
import socket
import qrcode
import io
import time
import random

app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'geckoshare-secret-key'
socketio = SocketIO(app, async_mode='threading')

# Configure silent logging for Werkzeug
import logging
logging.getLogger('werkzeug').setLevel(logging.ERROR)

UPLOAD_FOLDER = os.path.abspath("uploads")
ASSETS_FOLDER = os.path.abspath("assets")
STATIC_FOLDER = os.path.abspath("static")

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(ASSETS_FOLDER, filename)

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_FOLDER, filename)

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

connected_devices = {} # sid -> device_id
logged_devices = set() # Track already printed devices

# Group connected devices by unique ID to show real device count
def broadcast_unique_count():
    unique_count = len(set(connected_devices.values()))
    emit('update_connections', {'count': unique_count}, broadcast=True)

@socketio.on('connect')
def handle_connect():
    pass

@socketio.on('register_device')
def handle_register(data):
    device_id = data.get('device_id')
    device_info = data.get('device_info', 'Unknown Device')
    
    if device_id:
        connected_devices[request.sid] = device_id
        
        # Only log once per server session to avoid reload spam
        if device_id not in logged_devices:
            print(f"{device_info} joined now")
            logged_devices.add(device_id)
            
        broadcast_unique_count()

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in connected_devices:
        del connected_devices[request.sid]
        broadcast_unique_count()

@socketio.on('request_count')
def handle_request_count():
    unique_count = len(set(connected_devices.values()))
    emit('update_connections', {'count': unique_count})

SECURITY_CODE = str(random.randint(1000, 9999))

@app.route("/")
def home():
    return redirect(url_for('geckoshare', code=SECURITY_CODE))

# Main application route with security code validation
@app.route("/geckoshare", methods=["GET", "POST"])
def geckoshare():
    code = request.args.get('code')
    if code != SECURITY_CODE:
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>GeckoShare | Secure Access</title>
            <link rel="icon" type="image/x-icon" href="/assets/favicon.ico">
            <link href="https://fonts.googleapis.com/css2?family=Gloria+Hallelujah&display=swap" rel="stylesheet">
            <style>
                body {{
                    font-family: 'Gloria Hallelujah', cursive;
                    background: #FFFFFF;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    color: #2D3436;
                }}
                .login-card {{
                    text-align: center;
                    background: #F6FFD3;
                    padding: 3rem;
                    border-radius: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    width: 90%;
                    max-width: 400px;
                }}
                h1 {{ margin-bottom: 2rem; color: #2D3436; }}
                input {{
                    width: 100%;
                    padding: 1rem;
                    border: 2px solid #E2FF76;
                    border-radius: 15px;
                    font-family: inherit;
                    font-size: 1.2rem;
                    text-align: center;
                    margin-bottom: 1.5rem;
                    background: white;
                    color: #2D3436;
                    outline: none;
                }}
                button {{
                    background: #2D3436;
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 15px;
                    font-family: inherit;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }}
                button:hover {{
                    background: #E2FF76;
                    color: #2D3436;
                    transform: scale(1.05);
                }}
                .error-msg {{ color: #ff5252; margin-top: 1rem; font-size: 0.9rem; }}
            </style>
        </head>
        <body>
            <div class="login-card">
                <h1>GeckoShare</h1>
                <p>Enter Security Code to Join</p>
                <form action="/geckoshare" method="GET">
                    <input type="text" name="code" placeholder="4-digit code" autocomplete="off" autofocus>
                    <button type="submit">Enter Session</button>
                    {f'<div class="error-msg">Invalid Code. Try again!</div>' if code else ''}
                </form>
            </div>
        </body>
        </html>
        """, 403

    if request.method == "POST":
        if 'file' not in request.files:
            return redirect(request.url)
        file = request.files["file"]
        if file.filename == '':
            return redirect(request.url)
        if file:
            filepath = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(filepath)
            socketio.emit('file_uploaded', {'filename': file.filename})
            return redirect(url_for('geckoshare', code=SECURITY_CODE))

    files_info = []
    for filename in os.listdir(UPLOAD_FOLDER):
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(filepath):
            mtime = os.path.getmtime(filepath)
            files_info.append({
                'name': filename,
                'display_name': get_display_name(filename),
                'mtime': mtime,
                'time_ago': format_time_ago(mtime)
            })
    
    files_info.sort(key=lambda x: x['mtime'], reverse=True)
    
    ip = get_local_ip()
    local_url = f"http://{ip}:5000"
    return render_template("index.html", files=files_info, local_url=local_url, security_code=SECURITY_CODE)

def format_time_ago(mtime):
    diff = time.time() - mtime
    if diff < 60:
        return f"{int(diff)} secs ago"
    elif diff < 3600:
        return f"{int(diff // 60)} min ago"
    elif diff < 86400:
        return f"{int(diff // 3600)} hours ago"
    else:
        return f"{int(diff // 86400)} days ago"

@app.route("/download/<filename>")
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route("/delete/<filename>", methods=["POST"])
def delete_file(filename):
    code = request.args.get('code')
    if code != SECURITY_CODE:
        return {"status": "error", "message": "Unauthorized"}, 401

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            socketio.emit('file_uploaded', {'action': 'delete', 'filename': filename})
            return {"status": "success"}, 200
        except PermissionError:
            return {"status": "error", "message": "File is currently in use. Please try again in 1-2 seconds."}, 423
    return {"status": "error", "message": "File not found"}, 404

def get_display_name(filename):
    name_parts = os.path.splitext(filename)
    name = name_parts[0]
    ext = name_parts[1]
    
    if len(name) > 8:
        truncated = name[:3] + "___" + name[-3:]
        return truncated + ext
    return filename

@app.route("/qrcode")
def get_qrcode():
    ip = get_local_ip()
    url = f"http://{ip}:5000/geckoshare?code={SECURITY_CODE}"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)
    return send_file(buf, mimetype='image/png')

# Helper to find the local machine's IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == "__main__":
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        ip = get_local_ip()
        secure_url = f"http://{ip}:5000/geckoshare?code={SECURITY_CODE}"
        
        print(f"\n" + "="*40)
        print(f"GeckoShare")
        print(f"="*40)
        print(f"Security Code: {SECURITY_CODE}")
        print(f"Direct Link:   {secure_url}")
        print(f"\nScan to connect on your phone:")
        
        qr = qrcode.QRCode(version=1, box_size=1, border=4)
        qr.add_data(secure_url)
        qr.make(fit=True)
        qr.print_ascii()
        
        print("="*40 + "\n")
    
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
