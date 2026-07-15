import cv2
import os 
import numpy as np

IMG_DIR = "dataset/images"
LBL_DIR = "dataset/labels"

CLASS_ID =  0
CLASS_NAME = "keyboard"

DISPLAY_WIDTH = 800
DISPLAY_HEIGHT = 600

os.makedirs(LBL_DIR, exist_ok=True)

print ("Images folder:", IMG_DIR)
print ("Labels folder:", LBL_DIR)
print(f"display size (sabhi images ke liye same): {DISPLAY_WIDTH}x{DISPLAY_HEIGHT}")

drawing = False
box_ready = False
ix, iy = -1,-1
end_x, end_y = -1, -1

display_base = None  #current CANVAS(fixed size, box ke bina, clean copy)
display_img = None   #current CANVAS(box ke saath, screen par dikhane ke liye )

def draw_rectangle(events, x, y, flags, param):
    '''ye function har mouse action par  OpenCV khud call karega'''
    global ix,iy, end_x, end_y, drawing, box_ready,display_img,display_base

    if events == cv2.EVENT_LBUTTONDOWN:
        #Mouse button dabaya -> box ka starting point set karo 
        drawing = True
        box_ready = False
        ix , iy = x,y 
        end_x,end_y = x,y

      
    elif events == cv2.EVENT_MOUSEMOVE:
        # Mouse drag ho raha hai -> live preview dikhao
        if drawing:
            end_x, end_y = x, y
            display_img = original_img.copy()
            cv2.rectangle(display_img, (ix, iy), (end_x, end_y), (0, 255, 0), 2)

    elif events == cv2.EVENT_LBUTTONUP:
        # Mouse button chhoda -> box complete ho gaya
        drawing = False
        box_ready = True
        end_x, end_y = x, y
        display_img = original_img.copy()
        cv2.rectangle(display_img, (ix, iy), (end_x, end_y), (0, 255, 0), 2)

print("Mouse callback function ready hai.")

def convert_to_yolo(x1, y1, x2, y2, img_width, img_height):
    """Pixel coordinates (x1,y1,x2,y2) ko YOLO normalized format me convert karta hai."""

    # Ho sakta hai user ne box ulta (right-to-left) draw kiya ho, isliye min/max nikal lo
    x_min, x_max = min(x1, x2), max(x1, x2)
    y_min, y_max = min(y1, y2), max(y1, y2)

    box_width = x_max - x_min
    box_height = y_max - y_min

    x_center = x_min + box_width / 2
    y_center = y_min + box_height / 2

    # 0 se 1 ke beech normalize karo
    x_center_norm = x_center / img_width
    y_center_norm = y_center / img_height
    width_norm = box_width / img_width
    height_norm = box_height / img_height

    return x_center_norm, y_center_norm, width_norm, height_norm

print("Conversion function ready hai.")

image_files = sorted([
    f for f in os.listdir(IMG_DIR)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
])

print(f"Total images mili: {len(image_files)}")

if len(image_files) == 0:
    print("Koi image nahi mili! IMG_DIR path check karo.")
else:
    cv2.namedWindow("Image Annotation Tool")
    cv2.setMouseCallback("Image Annotation Tool", draw_rectangle)

    idx = 0
    while idx < len(image_files):
        image_name = image_files[idx]
        image_path = os.path.join(IMG_DIR, image_name)

        original_img = cv2.imread(image_path)

        if original_img is None:
            print(f"Skip (padhi nahi ja saki): {image_name}")
            idx += 1
            continue

        img_h, img_w = original_img.shape[:2]
        display_img = original_img.copy()
        box_ready = False

        # ---- Is image ke liye andar wala loop: jab tak koi key na dabe ----
        while True:
            preview = display_img.copy()
            status_text = f"[{idx+1}/{len(image_files)}] {image_name}  |  s=save  n=skip  p=prev  r=reset  q=quit"
            cv2.putText(preview, status_text, (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)

            cv2.imshow("Image Annotation Tool", preview)
            key = cv2.waitKey(20) & 0xFF

            if key == ord('s'):
                if box_ready:
                    x_c, y_c, w_n, h_n = convert_to_yolo(ix, iy, end_x, end_y, img_w, img_h)

                    label_name = os.path.splitext(image_name)[0] + ".txt"
                    label_path = os.path.join(LBL_DIR, label_name)

                    with open(label_path, "w") as f:
                        f.write(f"{CLASS_ID} {x_c:.6f} {y_c:.6f} {w_n:.6f} {h_n:.6f}\n")

                    print(f"Saved -> {label_path}")
                    idx += 1
                    break
                else:
                    print("Pehle box draw karo, phir 's' dabao.")

            elif key == ord('n'):
                print(f"Skipped -> {image_name}")
                idx += 1
                break

            elif key == ord('p'):
                idx = max(0, idx - 1)
                break

            elif key == ord('r'):
                display_img = original_img.copy()
                box_ready = False

            elif key == ord('q'):
                idx = len(image_files)   # loop ko yahi rok do
                break

    cv2.destroyAllWindows()
    print("\nAnnotation session complete!")

label_files = [f for f in os.listdir(LBL_DIR) if f.endswith(".txt")]
print(f"Total labels saved: {len(label_files)}")

if label_files:
    sample = label_files[0]
    print(f"\nSample file: {sample}")
    with open(os.path.join(LBL_DIR, sample)) as f:
        print(f.read())
