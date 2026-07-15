import os
import sys
import socket
import webbrowser
from threading import Timer
from app import app

DEFAULT_PORT = 5000

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def get_free_port(start_port):
    port = start_port
    while is_port_in_use(port):
        print(f"Port {port} is in use, trying next port...")
        port += 1
    return port

def open_browser(port):
    url = f"http://127.0.0.1:{port}"
    print(f"Opening browser at {url}...")
    webbrowser.open(url)

if __name__ == '__main__':
    # Print welcome banner
    print("=" * 60)
    print("        YOLO Image Annotator - Web Edition")
    print("=" * 60)
    
    # Find free port starting at 5000
    port = get_free_port(DEFAULT_PORT)
    
    # Open browser after 1 second (giving server time to boot)
    Timer(1.0, open_browser, args=[port]).start()
    
    # Run the Flask app
    try:
        app.run(host='127.0.0.1', port=port, debug=False)
    except Exception as e:
        print(f"Failed to start server: {e}")
        input("Press Enter to exit...")
