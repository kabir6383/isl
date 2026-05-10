import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface DetectionEngineProps {
  onGestureDetected: (gesture: string, index: number, confidence?: number, allProbs?: any) => void;
  onSystemMessage?: (event: any) => void;
}

export interface DetectionEngineRef {
  switchCamera: () => void;
  setCameraActive: (active: boolean) => void;
}

const DetectionEngine = forwardRef<DetectionEngineRef, DetectionEngineProps>(({ onGestureDetected, onSystemMessage }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [weights, setWeights] = useState<any>(null);

  useImperativeHandle(ref, () => ({
    switchCamera: () => {
      const js = `window.switchCamera(); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'SWITCH_CAMERA' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    },
    setCameraActive: (active: boolean) => {
      const js = `window.setCameraActive(${active}); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'SET_CAMERA_ACTIVE', value: active }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    }
  }));

  useEffect(() => {
    try {
      const modelWeights = require('../assets/model_weights.json');
      setWeights(modelWeights);
    } catch (e) {
      console.warn("DetectionEngine: Weights not loaded");
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'GESTURE') onGestureDetected(data.value, data.handIndex, data.confidence, data.allProbs);
          if (data.type === 'GESTURE_CLEAR') onGestureDetected('CLEAR_HUD', -1, 0, data.allProbs);
          if ((data.type === 'TTS' || data.type === 'LOG') && onSystemMessage) {
             onSystemMessage({ nativeEvent: { data: JSON.stringify(data) } } as any);
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [onGestureDetected, onSystemMessage]);

  const weightsJson = weights ? JSON.stringify(weights) : 'null';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossorigin="anonymous"></script>
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" crossorigin="anonymous"></script>
      <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #000; font-family: sans-serif; }
        #container { 
          position: relative; 
          width: 100vw; 
          height: 100vh; 
          transform: scaleX(-1); 
          display: flex;
          justify-content: center;
          align-items: center;
          background: #000;
        }
        canvas { 
          position: absolute; 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
        }
        video { 
          position: absolute; 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
          opacity: 0; 
          pointer-events: none; 
        }
        #status {
          position: absolute;
          bottom: 10px;
          left: 10px;
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          transform: scaleX(-1);
          z-index: 100;
        }
      </style>
    </head>
    <body>
      <div id="container">
        <video id="input_video" playsinline muted autoplay></video>
        <canvas id="output_canvas"></canvas>
        <div id="status">INITIALIZING_AI_CORE...</div>
      </div>
      <script>
        const video = document.getElementById('input_video');
        const canvas = document.getElementById('output_canvas');
        const status = document.getElementById('status');
        const ctx = canvas.getContext('2d', { alpha: false });

        function sendMsg(data) {
          const s = JSON.stringify(data);
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
          if (window.parent) window.parent.postMessage(s, '*');
        }

        window.MODEL_DATA = ${weightsJson};
        const handStates = [{ last: "", count: 0, buffer: [] }];
        let latestLandmarks = [];
        let currentFacingMode = 'user';
        let cameraInstance = null;
        let isProcessing = false;
        let isCameraEnabled = true;

        window.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'SWITCH_CAMERA') window.switchCamera();
            if (data.type === 'SET_CAMERA_ACTIVE') window.setCameraActive(data.value);
          } catch(err){}
        });

        function predict(input) {
          if (!window.MODEL_DATA) return null;
          let current = input;
          for (let i = 0; i < window.MODEL_DATA.layers.length; i++) {
            const layer = window.MODEL_DATA.layers[i];
            const next = new Array(layer.b.length).fill(0);
            for (let j = 0; j < layer.b.length; j++) {
              let sum = layer.b[j];
              for (let k = 0; k < current.length; k++) {
                sum += current[k] * layer.w[k][j];
              }
              next[j] = (i === window.MODEL_DATA.layers.length - 1) ? sum : Math.max(0, sum);
            }
            current = next;
          }
          const exp = current.map(v => Math.exp(v));
          const sum = exp.reduce((a, b) => a + b, 0);
          const probs = exp.map(v => v / sum);
          let maxIdx = 0;
          for (let i = 1; i < probs.length; i++) {
            if (probs[i] > probs[maxIdx]) maxIdx = i;
          }
          const allProbs = {};
          window.MODEL_DATA.classes.forEach((c, idx) => allProbs[c] = probs[idx]);
          return { label: window.MODEL_DATA.classes[maxIdx], confidence: probs[maxIdx], allProbs };
        }

        function onResults(results) {
          if (!isCameraEnabled) return;
          latestLandmarks = results.multiHandLandmarks || [];
          if (latestLandmarks.length === 0) {
            sendMsg({ type: 'GESTURE_CLEAR', allProbs: { "agree": 0, "from": 0, "specific": 0, "you": 0 } });
            return;
          }

          latestLandmarks.forEach((landmarks, index) => {
            if (index >= 1) return;
            const bx = landmarks[0].x, by = landmarks[0].y;
            const dx = landmarks[9].x - bx, dy = landmarks[9].y - by;
            const scale = Math.sqrt(dx*dx + dy*dy) || 0.1;
            const angle = Math.atan2(dy, dx);
            const cosA = Math.cos(-angle), sinA = Math.sin(-angle);

            const input = [];
            for (let i = 0; i < 21; i++) {
              const tx = (landmarks[i].x - bx) / scale, ty = (landmarks[i].y - by) / scale;
              input.push(tx * cosA - ty * sinA);
              input.push(tx * sinA + ty * cosA);
            }
            for (let i = 0; i < 21; i++) {
              const d = Math.sqrt(Math.pow(landmarks[i].x - bx, 2) + Math.pow(landmarks[i].y - by, 2)) / scale;
              input.push(d);
            }
            const pairs = [[4,8], [8,12], [12,16], [16,20], [4,20]];
            for (const [p1, p2] of pairs) {
              const d = Math.sqrt(Math.pow(landmarks[p1].x - landmarks[p2].x, 2) + Math.pow(landmarks[p1].y - landmarks[p2].y, 2)) / scale;
              input.push(d);
            }
            
            const pred = predict(input);
            if (pred && pred.confidence > 0.85) {
              const state = handStates[index];
              if (pred.label !== state.last) {
                 sendMsg({ type: 'GESTURE', value: pred.label, handIndex: index, confidence: pred.confidence, allProbs: pred.allProbs });
                 state.last = pred.label;
              }
            }
          });
        }

        function renderLoop() {
          if (isCameraEnabled && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (latestLandmarks.length > 0) {
              latestLandmarks.forEach((landmarks, index) => {
                if (index >= 1) return;
                drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#38bdf8', lineWidth: 4});
                drawLandmarks(ctx, landmarks, {color: '#FFFFFF', lineWidth: 2, radius: 3});
              });
            }
          } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          requestAnimationFrame(renderLoop);
        }
        renderLoop();

        const hands = new Hands({locateFile: (f) => "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + f});
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onResults);

        async function initCamera() {
          if (cameraInstance) { try { await cameraInstance.stop(); } catch(e){} cameraInstance = null; }
          if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
          if (!isCameraEnabled) return;

          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: currentFacingMode }
            });
            video.srcObject = stream;
            video.onloadedmetadata = () => {
              video.play();
              cameraInstance = new Camera(video, {
                onFrame: async () => { if (!isProcessing && isCameraEnabled) { isProcessing = true; try { await hands.send({image: video}); } catch(e){} isProcessing = false; } },
                width: 640, height: 480
              });
              cameraInstance.start().then(() => {
                status.innerText = 'LITE_ENGINE: ' + currentFacingMode.toUpperCase();
                sendMsg({type: 'LOG', msg: 'Lens Active: ' + currentFacingMode});
              });
            };
          } catch (err) { status.innerText = 'CAMERA_ERROR: ' + err.message; }
        }

        window.switchCamera = () => {
          currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
          const container = document.getElementById('container');
          container.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
          initCamera();
        };

        window.setCameraActive = (active) => {
          isCameraEnabled = active;
          if (!active) {
            status.innerText = 'SYSTEM_OFFLINE';
            latestLandmarks = [];
            sendMsg({ type: 'GESTURE_CLEAR', allProbs: { "agree": 0, "from": 0, "specific": 0, "you": 0 } });
          }
          initCamera();
        };

        initCamera();

        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize);
        resize();
      </script>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          ref={iframeRef as any}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
          allow="camera; microphone"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'http://localhost' }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        mediaCapturePermissionGrantType="grant"
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'GESTURE') onGestureDetected(data.value, data.handIndex, data.confidence, data.allProbs);
            if (data.type === 'GESTURE_CLEAR') onGestureDetected('CLEAR_HUD', -1, 0, data.allProbs);
            if ((data.type === 'TTS' || data.type === 'LOG') && onSystemMessage) onSystemMessage(e);
          } catch (err) {}
        }}
        scrollEnabled={false}
        onPermissionRequest={(event) => {
          event.request.grant(event.request.resources);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: 'transparent' }
});

export default DetectionEngine;
