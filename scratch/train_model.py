import os
import cv2
import json
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.utils import shuffle

# Configuration
DATASET_PATH = r"C:\Users\acer\OneDrive\Desktop\islrs\dataset"
MODEL_ASSET_PATH = "hand_landmarker.task"
CLASSES = ["agree", "from", "specific", "you"]

def get_hand_scale(landmarks):
    bx, by = landmarks[0].x, landmarks[0].y
    dx = landmarks[9].x - bx
    dy = landmarks[9].y - by
    return np.sqrt(dx*dx + dy*dy) or 0.1

def extract_dhg_features(landmarks):
    """Differential Hand Geometry - Senior Feature Engineering"""
    bx, by = landmarks[0].x, landmarks[0].y
    scale = get_hand_scale(landmarks)
    angle = np.arctan2(landmarks[9].y - by, landmarks[9].x - bx)
    cos_a = np.cos(-angle)
    sin_a = np.sin(-angle)
    
    features = []
    # 1. Normalized & Rotated Coordinates (42 features)
    for lm in landmarks:
        tx = (lm.x - bx) / scale
        ty = (lm.y - by) / scale
        features.append(tx * cos_a - ty * sin_a)
        features.append(tx * sin_a + ty * cos_a)
        
    # 2. Euclidean Distances from Wrist (21 features)
    for lm in landmarks:
        dist = np.sqrt((lm.x - bx)**2 + (lm.y - by)**2) / scale
        features.append(dist)
        
    # 3. INTER-FINGER DIFFERENTIALS (Specific vs From distinction)
    # Distance between Thumb tip(4) and Index tip(8)
    # Distance between Index tip(8) and Middle tip(12)
    # Distance between Middle tip(12) and Ring tip(16)
    # Distance between Ring tip(16) and Pinky tip(20)
    pairs = [(4,8), (8,12), (12,16), (16,20), (4,20)]
    for p1, p2 in pairs:
        d = np.sqrt((landmarks[p1].x - landmarks[p2].x)**2 + (landmarks[p1].y - landmarks[p2].y)**2) / scale
        features.append(d)
        
    return np.array(features)

def augment_pro(features, class_name):
    augments = [features]
    # Intensive augmentation for classes prone to confusion
    count = 12 if class_name in ['from', 'specific'] else 6
    for _ in range(count):
        noise = np.random.normal(0, 0.015, len(features))
        augments.append(features + noise)
    return augments

def train():
    base_options = python.BaseOptions(model_asset_path=MODEL_ASSET_PATH)
    options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=1)
    detector = vision.HandLandmarker.create_from_options(options)

    X, y = [], []

    print("Extracting DHG Features (Coords + Distances + Differentials)...")
    for class_name in CLASSES:
        class_dir = os.path.join(DATASET_PATH, class_name)
        if not os.path.exists(class_dir): continue
        count = 0
        for user_dir in os.listdir(class_dir):
            user_path = os.path.join(class_dir, user_dir)
            if not os.path.isdir(user_path): continue
            for img_name in os.listdir(user_path):
                if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')): continue
                img_path = os.path.join(user_path, img_name)
                image = cv2.imread(img_path)
                if image is None: continue
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                results = detector.detect(mp_image)
                if results.hand_landmarks:
                    feats = extract_dhg_features(results.hand_landmarks[0])
                    for aug in augment_pro(feats, class_name):
                        X.append(aug)
                        y.append(class_name)
                    count += 1
        print(f"  {class_name}: {count} raw -> {len(X)} total samples")

    X, y = np.array(X), np.array(y)
    X, y = shuffle(X, y, random_state=42)
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    print(f"Training DHG MLP (512-256-128-64) on {len(X)} samples...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(512, 256, 128, 64),
        max_iter=5000,
        activation='relu',
        solver='adam',
        alpha=0.0001,
        early_stopping=True,
        validation_fraction=0.1
    )
    
    mlp.fit(X, y_encoded)
    score = getattr(mlp, 'best_validation_score_', mlp.score(X, y_encoded))
    print(f"DHG Training Complete. Score: {score*100:.2f}%")

    weights = {
        "classes": le.classes_.tolist(),
        "layers": [{"w": mlp.coefs_[i].tolist(), "b": mlp.intercepts_[i].tolist()} for i in range(len(mlp.coefs_))]
    }

    with open(r'C:\Users\acer\OneDrive\Desktop\islrs\assets\model_weights.json', 'w') as f:
        json.dump(weights, f)
    print("DHG Weights exported successfully")

if __name__ == "__main__":
    train()
