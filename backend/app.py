from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image
import numpy as np
import base64
import io
import os
from dotenv import load_dotenv
load_dotenv()
import anthropic

app = Flask(__name__)
CORS(app)

print("Loading YOLOv8 model...")
model = YOLO("yolov8n.pt")
print("Model loaded!")

def analyze_image_health(image):
    img_array = np.array(image)
    if len(img_array.shape) == 3:
        r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
        green_ratio = np.mean(g) / (np.mean(r) + np.mean(g) + np.mean(b) + 1)
        yellow_mask = (r > 150) & (g > 150) & (b < 100)
        brown_mask = (r > 100) & (g < 80) & (b < 60)
        dark_spots = (r < 50) & (g < 50) & (b < 50)
        total_pixels = img_array.shape[0] * img_array.shape[1]
        yellow_ratio = np.sum(yellow_mask) / total_pixels
        brown_ratio = np.sum(brown_mask) / total_pixels
        dark_ratio = np.sum(dark_spots) / total_pixels
        disease_score = (yellow_ratio * 0.4 + brown_ratio * 0.4 + dark_ratio * 0.2) * 100
        if disease_score < 5:
            health, severity, confidence = "Healthy", "None", 92
        elif disease_score < 15:
            health, severity, confidence = "Mild", "Low", 78
        elif disease_score < 30:
            health, severity, confidence = "Moderate", "Medium", 85
        else:
            health, severity, confidence = "Severe", "High", 88
        if yellow_ratio > 0.1:
            possible_disease = "Yellow Leaf Curl Virus / Nutrient Deficiency"
        elif brown_ratio > 0.1:
            possible_disease = "Early Blight / Fungal Infection"
        elif dark_ratio > 0.05:
            possible_disease = "Bacterial Spot / Late Blight"
        else:
            possible_disease = "No disease detected"
        return {
            "health_status": health,
            "severity": severity,
            "confidence": confidence,
            "possible_disease": possible_disease,
            "disease_score": round(disease_score, 2),
            "green_ratio": round(green_ratio * 100, 2),
            "affected_area": round(disease_score, 1)
        }
    return {"health_status": "Unknown", "severity": "Unknown", "confidence": 0}

def run_yolo_detection(image):
    results = model(image, conf=0.25)
    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is not None:
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model.names[cls]
                detections.append({
                    "class": name,
                    "confidence": round(conf * 100, 1),
                    "bbox": box.xyxy[0].tolist()
                })
    return detections

def get_recommendations(health_status):
    recs = {
        "Healthy": [
            "Plant healthy hai, regular care continue karo",
            "Weekly watering maintain karo",
            "Monthly fertilizer dena na bhoolo"
        ],
        "Mild": [
            "Affected leaves remove karo",
            "Neem oil spray karo — natural pesticide",
            "Watering reduce karo, overwatering avoid karo",
            "Better air circulation ensure karo"
        ],
        "Moderate": [
            "Fungicide/Bactericide spray immediately karo",
            "Severely affected branches prune karo",
            "Plant ko isolate karo doosron se",
            "Soil drainage improve karo",
            "Expert se consult karo"
        ],
        "Severe": [
            "URGENT: Plant ko immediately isolate karo",
            "Professional fungicide treatment shuru karo",
            "Saari affected parts remove karo",
            "Soil replace karne par consider karo",
            "Agricultural expert se milna zaroori hai"
        ]
    }
    return recs.get(health_status, ["Analysis inconclusive, expert se consult karo"])

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "running", "model": "YOLOv8n", "version": "2.0"})

@app.route("/analyze", methods=["POST"])
def analyze_plant():
    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"error": "Image data missing"}), 400
        image_data = data["image"]
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_resized = image.resize((640, 640))
        health_analysis = analyze_image_health(image_resized)
        yolo_detections = run_yolo_detection(image_resized)
        return jsonify({
            "success": True,
            "health_analysis": health_analysis,
            "yolo_detections": yolo_detections,
            "image_size": {"width": image.width, "height": image.height},
            "recommendations": get_recommendations(health_analysis["health_status"])
        })
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route("/claude-analyze", methods=["POST"])
def claude_analyze():
    try:
        data = request.get_json()
        image_data = data["image"]
        if "," in image_data:
            media_type = image_data.split(";")[0].split(":")[1]
            image_base64 = image_data.split(",")[1]
        else:
            media_type = "image/jpeg"
            image_base64 = image_data

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return jsonify({"success": False, "error": "ANTHROPIC_API_KEY not set"}), 500

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": "Analyze this plant image. Identify the species, check for diseases, provide medicinal properties and care recommendations. Use clear sections with bold headers."
                    }
                ]
            }]
        )
        return jsonify({"success": True, "result": message.content[0].text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/claude-chat", methods=["POST"])
def claude_chat():
    try:
        data = request.get_json()
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return jsonify({"success": False, "error": "ANTHROPIC_API_KEY not set"}), 500

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=data.get("system", "You are BotaniAI, an expert botanical research assistant."),
            messages=data["messages"]
        )
        return jsonify({"success": True, "result": message.content[0].text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    print("=" * 50)
    print("BotaniAI Backend Server Starting...")
    print("URL: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)