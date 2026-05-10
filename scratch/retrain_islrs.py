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
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(PROJECT_ROOT, "dataset")
ASSETS_PATH = os.path.join(PROJECT_ROOT, "assets")
WEIGHTS_FILE = os.path.join(ASSETS_PATH, "model_weights.json")
MODEL_ASSET_PATH = os.path.join(PROJECT_ROOT, "hand_landmarker.task")

def get_hand_scale(landmarks):
    # landmarks is a list of landmark objects with x, y
    bx, by = landmarks[0].x, landmarks[0].y
    dx = landmarks[9].x - bx
    dy = landmarks[9].y - by
    return np.sqrt(dx*dx + dy*dy) or 0.1

def extract_dhg_features(landmarks):
    """Differential Hand Geometry - 68 Features"""
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
        
    # 3. INTER-FINGER DIFFERENTIALS (5 features)
    pairs = [(4,8), (8,12), (12,16), (16,20), (4,20)]
    for p1, p2 in pairs:
        d = np.sqrt((landmarks[p1].x - landmarks[p2].x)**2 + (landmarks[p1].y - landmarks[p2].y)**2) / scale
        features.append(d)
        
    return np.array(features)

def augment_features(features, multiplier=5):
    augments = [features]
    for _ in range(multiplier):
        # Increased noise range for better generalization
        noise = np.random.normal(0, 0.02, len(features))
        augments.append(features + noise)
    return augments

def train():
    base_options = python.BaseOptions(model_asset_path=MODEL_ASSET_PATH)
    options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=2)
    detector = vision.HandLandmarker.create_from_options(options)
    
    X, y = [], []
    classes = [d for d in os.listdir(DATASET_PATH) if os.path.isdir(os.path.join(DATASET_PATH, d))]
    
    print(f"Detected Classes: {classes}")

    for class_name in classes:
        class_dir = os.path.join(DATASET_PATH, class_name)
        files = [f for f in os.listdir(class_dir) if os.path.isfile(os.path.join(class_dir, f))]
        
        # Calculate multiplier to balance classes (target ~1000 samples per class)
        # Assuming each video gives ~30 samples, images give 1.
        if class_name == 'how are you':
            multiplier = 25 # 40 images * 25 = 1000
        else:
            multiplier = 5  # ~30 frames * ~11-21 videos * 5 = 1500-3000
            
        print(f"Processing {class_name} ({len(files)} files, x{multiplier} aug)...")
        
        for file_name in files:
            file_path = os.path.join(class_dir, file_name)
            ext = file_name.lower()
            
            if ext.endswith(('.mov', '.mp4', '.avi')):
                cap = cv2.VideoCapture(file_path)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                sample_rate = max(1, total_frames // 30)
                frame_idx = 0
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret: break
                    if frame_idx % sample_rate == 0:
                        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                        results = detector.detect(mp_image)
                        if results.hand_landmarks:
                            for hand_lms in results.hand_landmarks:
                                feats = extract_dhg_features(hand_lms)
                                for aug in augment_features(feats, multiplier):
                                    X.append(aug)
                                    y.append(class_name)
                    frame_idx += 1
                cap.release()
            elif ext.endswith(('.png', '.jpg', '.jpeg')):
                image = cv2.imread(file_path)
                if image is None: continue
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                results = detector.detect(mp_image)
                if results.hand_landmarks:
                    for hand_lms in results.hand_landmarks:
                        feats = extract_dhg_features(hand_lms)
                        for aug in augment_features(feats, multiplier):
                            X.append(aug)
                            y.append(class_name)

    # ADD SYNTHETIC "NONE" CLASS (Background Rejection)
    # This generates random hand landmarks that are topologically possible but mean nothing
    print("Generating Synthetic 'None' class samples...")
    for _ in range(1000):
        # Base on a "relaxed" hand pose with high jitter
        base_feats = np.random.uniform(-1, 1, 68) 
        X.append(base_feats)
        y.append("None")
            
    if not X:
        print("Error: No features extracted.")
        return

    X, y = np.array(X), np.array(y)
    X, y = shuffle(X, y, random_state=42)
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    print(f"Training Robust MLP on {len(X)} samples across {len(le.classes_)} classes...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(512, 256, 128, 64),
        max_iter=5000,
        alpha=0.001, # Higher regularization to prevent overconfidence
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42
    )
    
    mlp.fit(X, y_encoded)
    score = getattr(mlp, 'best_validation_score_', mlp.score(X, y_encoded))
    print(f"High-Accuracy Training Complete. Score: {score*100:.2f}%")

    # Export weights
    weights = {
        "classes": le.classes_.tolist(),
        "layers": [{"w": mlp.coefs_[i].tolist(), "b": mlp.intercepts_[i].tolist()} for i in range(len(mlp.coefs_))]
    }

    os.makedirs(ASSETS_PATH, exist_ok=True)
    with open(WEIGHTS_FILE, 'w') as f:
        json.dump(weights, f)
    
    print(f"Weights exported to {WEIGHTS_FILE}")

if __name__ == "__main__":
    train()
