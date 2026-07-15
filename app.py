import os
import sys
from flask import Flask, jsonify, request, send_from_directory, render_template

app = Flask(__name__, static_folder='static', template_folder='templates')

# Paths relative to the root of the project
IMG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset", "images"))
LBL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset", "labels"))
CLASSES_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "classes.txt"))

# Ensure directories exist
os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(LBL_DIR, exist_ok=True)

# Default classes if classes.txt does not exist
DEFAULT_CLASSES = ["keyboard"]

def load_classes():
    if not os.path.exists(CLASSES_FILE):
        with open(CLASSES_FILE, "w", encoding="utf-8") as f:
            for cls in DEFAULT_CLASSES:
                f.write(f"{cls}\n")
        return DEFAULT_CLASSES
    
    with open(CLASSES_FILE, "r", encoding="utf-8") as f:
        classes = [line.strip() for line in f if line.strip()]
    return classes

def save_classes_to_file(classes):
    with open(CLASSES_FILE, "w", encoding="utf-8") as f:
        for cls in classes:
            f.write(f"{cls}\n")

def get_yolo_boxes(label_path):
    boxes = []
    if os.path.exists(label_path):
        try:
            with open(label_path, "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        try:
                            class_id = int(parts[0])
                            x_c = float(parts[1])
                            y_c = float(parts[2])
                            w = float(parts[3])
                            h = float(parts[4])
                            boxes.append({
                                "class_id": class_id,
                                "x_center": x_c,
                                "y_center": y_c,
                                "width": w,
                                "height": h
                            })
                        except ValueError:
                            continue
        except Exception as e:
            print(f"Error reading label file {label_path}: {e}")
    return boxes

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMG_DIR, filename)

@app.route('/api/images', methods=['GET'])
def get_images():
    classes = load_classes()
    image_files = sorted([
        f for f in os.listdir(IMG_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])
    
    images_data = []
    for img in image_files:
        label_name = os.path.splitext(img)[0] + ".txt"
        label_path = os.path.join(LBL_DIR, label_name)
        boxes = get_yolo_boxes(label_path)
        
        images_data.append({
            "filename": img,
            "annotated": len(boxes) > 0,
            "boxes": boxes
        })
        
    return jsonify({
        "images": images_data,
        "classes": classes
    })

@app.route('/api/save', methods=['POST'])
def save_annotation():
    data = request.json
    if not data or 'filename' not in data or 'boxes' not in data:
        return jsonify({"status": "error", "message": "Invalid payload"}), 400
    
    filename = data['filename']
    boxes = data['boxes']
    
    label_name = os.path.splitext(filename)[0] + ".txt"
    label_path = os.path.join(LBL_DIR, label_name)
    
    try:
        if not boxes:
            # If no boxes are drawn and we click save, delete the file if it exists (or keep it empty)
            if os.path.exists(label_path):
                os.remove(label_path)
            return jsonify({"status": "success", "message": "Label cleared"})
        
        with open(label_path, "w", encoding="utf-8") as f:
            for box in boxes:
                class_id = box['class_id']
                x_c = box['x_center']
                y_c = box['y_center']
                w = box['width']
                h = box['height']
                f.write(f"{class_id} {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}\n")
                
        return jsonify({"status": "success", "message": "Label saved"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/classes', methods=['POST'])
def save_classes():
    data = request.json
    if not data or 'classes' not in data:
        return jsonify({"status": "error", "message": "Invalid payload"}), 400
    
    classes = data['classes']
    try:
        save_classes_to_file(classes)
        return jsonify({"status": "success", "message": "Classes updated"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Start the server locally
    app.run(host='127.0.0.1', port=5000, debug=True)
