import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';


const DetectionEngine = forwardRef(({ onGestureDetected, onSystemMessage }, ref) => {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const [weights, setWeights] = useState(null);

  useImperativeHandle(ref, () => ({
    switchCamera: () => {
      const js = `window.switchCamera(); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'SWITCH_CAMERA' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    },
    setCameraActive: (active) => {
      const js = `window.setCameraActive(${active}); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'SET_CAMERA_ACTIVE', value: active }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    },
    startVoice: () => {
      const js = `window.postMessage(JSON.stringify({ type: 'START_VOICE' }), '*'); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'START_VOICE' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    },
    stopVoice: () => {
      const js = `window.postMessage(JSON.stringify({ type: 'STOP_VOICE' }), '*'); true;`;
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'STOP_VOICE' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(js);
      }
    },
    getModelClasses: () => {
      return weights ? weights.classes : [];
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
      const handleWebMessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'GESTURE') onGestureDetected(data.value, data.handIndex, data.confidence, data.allProbs);
          if (data.type === 'GESTURE_CLEAR') onGestureDetected('CLEAR_HUD', -1, 0, data.allProbs);
          if (data.type === 'VOICE_RESULT' || data.type === 'VOICE_STATUS') onGestureDetected(data);
          if ((data.type === 'TTS' || data.type === 'LOG') && onSystemMessage) {
             onSystemMessage({ nativeEvent: { data: JSON.stringify(data) } });
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [onGestureDetected, onSystemMessage, weights]);

  const injectModel = () => {
    if (weights && (webViewRef.current || iframeRef.current)) {
      const data = JSON.stringify({ type: 'LOAD_MODEL', value: weights });
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(data, '*');
      } else {
        webViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(data)}, '*'); true;`);
      }
    }
  };

  useEffect(() => {
    if (weights) {
      setTimeout(injectModel, 2000); // Give WebView time to start listener
    }
  }, [weights]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://unpkg.com/@mediapipe/holistic/holistic.js" crossorigin="anonymous"></script>
      <script src="https://unpkg.com/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
      <script src="https://unpkg.com/@mediapipe/drawing_utils/drawing_utils.js" crossorigin="anonymous"></script>
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
        <div id="status">INITIALIZING_HOLISTIC_ENGINE...</div>
      </div>
      <script>
        const video = document.getElementById('input_video');
        const canvas = document.getElementById('output_canvas');
        const status = document.getElementById('status');
        const ctx = canvas.getContext('2d', { alpha: false });
        let currentFacingMode = 'user';
        let cameraInstance = null;
        let isProcessing = false;
        let isCameraEnabled = true;
        let latestResults = null;

        function sendMsg(data) {
          const s = JSON.stringify(data);
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
          if (window.parent) window.parent.postMessage(s, '*');
        }

        window.MODEL_DATA = null;
        window.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'LOAD_MODEL') {
              window.MODEL_DATA = data.value;
              status.innerText = 'MODEL_LOADED';
              status.style.color = '#10b981';
            }
            if (data.type === 'SWITCH_CAMERA') window.switchCamera();
            if (data.type === 'SET_CAMERA_ACTIVE') window.setCameraActive(data.value);
            if (data.type === 'START_VOICE' && recognition) recognition.start();
            if (data.type === 'STOP_VOICE' && recognition) recognition.stop();
          } catch(err){}
        });

        const handStates = [
          { last: "", buffer: [] }, 
          { last: "", buffer: [] }
        ];

        function getMajority(buffer) {
          const counts = {};
          buffer.forEach(x => counts[x] = (counts[x] || 0) + 1);
          let max = 0, label = "";
          for (const key in counts) {
            if (counts[key] > max) { max = counts[key]; label = key; }
          }
          return { label, count: max };
        }

        let recognition = null;
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
          recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interimTranscript += event.results[i][0].transcript;
            }
            sendMsg({ type: 'VOICE_RESULT', value: interimTranscript });
          };
          
          recognition.onstart = () => sendMsg({ type: 'VOICE_STATUS', value: 'LISTENING' });
          recognition.onend = () => sendMsg({ type: 'VOICE_STATUS', value: 'IDLE' });
          recognition.onerror = (e) => sendMsg({ type: 'VOICE_ERROR', value: e.error });
        }


        function predict(landmarks) {
          if (!window.MODEL_DATA || !landmarks) return null;
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
          latestResults = results;

          if (!results.leftHandLandmarks && !results.rightHandLandmarks) {
            sendMsg({ type: 'GESTURE_CLEAR', allProbs: {} });
          }

          // Process Hands for Gestures
          [results.leftHandLandmarks, results.rightHandLandmarks].forEach((landmarks, index) => {
            if (!landmarks) {
              handStates[index].buffer = [];
              handStates[index].last = ""; 
              return;
            }
            
            const pred = predict(landmarks);
            
            // STRICT ACCURACY: Higher threshold (0.95) and dataset-only matching
            const isDatasetSign = pred && pred.label !== "None" && pred.label !== "NONE";
            
            if (isDatasetSign && pred.confidence > 0.95) { 
              const state = handStates[index];
              state.buffer.push(pred.label);
              if (state.buffer.length > 5) state.buffer.shift(); // 5-frame window for better stability

              const majority = getMajority(state.buffer);
              // Require high agreement (3/5) for a match
              if (majority.count >= 3 && majority.label !== state.last) {
                 sendMsg({ 
                   type: 'GESTURE', 
                   value: majority.label, 
                   handIndex: index, 
                   confidence: pred.confidence, 
                   allProbs: pred.allProbs,
                   isMatch: true 
                 });
                 state.last = majority.label;
                 status.innerText = 'MATCH: ' + majority.label.toUpperCase();
                 status.style.color = '#10b981';
                 setTimeout(() => { if(status.innerText.includes('MATCH')) status.innerText = ''; }, 1000);
              }
            } else if (pred && pred.confidence < 0.7) {
               // Noise rejection
               handStates[index].buffer = [];
               handStates[index].last = "None";
            }
          });
        }

        function renderLoop() {
          if (isCameraEnabled && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (latestResults) {
              // 1. Draw Pose Skeleton (Body) - 3% Opacity
              if (latestResults.poseLandmarks) {
                window.drawConnectors(ctx, latestResults.poseLandmarks, window.POSE_CONNECTIONS, {color: 'rgba(255,255,255,0.03)', lineWidth: 1});
                window.drawLandmarks(ctx, latestResults.poseLandmarks, {color: 'rgba(56, 189, 248, 0.03)', lineWidth: 1, radius: 1});
              }

              // 2. Draw Face Mesh - 3% Opacity
              if (latestResults.faceLandmarks) {
                window.drawConnectors(ctx, latestResults.faceLandmarks, window.FACEMESH_TESSELATION, {color: 'rgba(255,255,255,0.03)', lineWidth: 1});
              }

              // 3. Draw Hands - FULL Opacity (Priority)
              if (latestResults.leftHandLandmarks) {
                window.drawConnectors(ctx, latestResults.leftHandLandmarks, window.HAND_CONNECTIONS, {color: '#38bdf8', lineWidth: 4});
                window.drawLandmarks(ctx, latestResults.leftHandLandmarks, {color: '#FFFFFF', lineWidth: 1, radius: 2});
              }
              if (latestResults.rightHandLandmarks) {
                window.drawConnectors(ctx, latestResults.rightHandLandmarks, window.HAND_CONNECTIONS, {color: '#38bdf8', lineWidth: 4});
                window.drawLandmarks(ctx, latestResults.rightHandLandmarks, {color: '#FFFFFF', lineWidth: 1, radius: 2});
              }
            }
          } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          requestAnimationFrame(renderLoop);
        }
        renderLoop();

        const holistic = new window.Holistic({locateFile: (f) => 'https://unpkg.com/@mediapipe/holistic/' + f});
        holistic.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          refineFaceLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        holistic.onResults(onResults);

        async function initCamera(retryCount = 0) {
          console.log("initCamera called, active:", isCameraEnabled);
          if (cameraInstance) { try { await cameraInstance.stop(); } catch(e){} cameraInstance = null; }
          if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
          if (!isCameraEnabled) return;

          status.innerText = 'REQUESTING_CAMERA...';
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { 
                width: { ideal: 480 }, 
                height: { ideal: 360 }, 
                frameRate: { ideal: 30 },
                facingMode: currentFacingMode 
              }
            });
            console.log("Stream acquired");
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
              video.play().then(() => {
                if (!window.Camera) {
                   status.innerText = 'ERROR: MediaPipe Camera Utility not found';
                   return;
                }
                cameraInstance = new window.Camera(video, {
                  onFrame: async () => { 
                    if (!isProcessing && isCameraEnabled && window.MODEL_DATA) { 
                      isProcessing = true; 
                      try { await holistic.send({image: video}); } catch(e){} 
                      isProcessing = false; 
                    } 
                  },
                  width: 480, height: 360
                });
                cameraInstance.start().then(() => {
                  status.innerText = '';
                  console.log("MediaPipe Camera Started");
                  sendMsg({type: 'LOG', msg: 'Lens Active: ' + currentFacingMode});
                }).catch(err => {
                  console.error("Camera.start error:", err);
                  status.innerText = 'CAMERA_START_FAIL: ' + err.message;
                });
              }).catch(err => {
                console.error("Video.play error:", err);
                status.innerText = 'VIDEO_PLAY_FAIL: ' + err.message;
              });
            };
          } catch (err) { 
            console.error("getUserMedia error:", err);
            status.innerText = 'CAMERA_DENIED: ' + err.message; 
            if (retryCount < 3) {
              console.log("Retrying camera in 2s...");
              setTimeout(() => initCamera(retryCount + 1), 2000);
            }
          }
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
            status.innerText = 'SYSTEM_PAUSED';
            latestResults = null;
            sendMsg({ type: 'GESTURE_CLEAR', allProbs: {} });
            if (cameraInstance) cameraInstance.stop();
          } else {
            initCamera();
          }
        };

        // Auto-start camera with small delay for script stability
        if (isCameraEnabled) {
          setTimeout(() => initCamera(), 1000);
        } else {
          status.innerText = 'CLICK_POWER_TO_START';
        }

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
          ref={iframeRef}
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
            if (data.type === 'VOICE_RESULT' || data.type === 'VOICE_STATUS') onGestureDetected(data);
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
