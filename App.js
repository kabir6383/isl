import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import React, { useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { Camera } from 'expo-camera';
import Dashboard from './screens/Dashboard';
import { COLORS } from './constants/Theme';

export default function App() {
  const [lastLog, setLastLog] = React.useState(null);
  const [lastSpoken, setLastSpoken] = React.useState({ text: '', time: 0 });

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
      
      if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
        Alert.alert(
          "Permissions Required",
          "ISLRS needs Camera and Microphone access to function as a two-way communication hub.",
          [{ text: "OK" }]
        );
      }
    })();
  }, []);

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle Speech for full phrases (TTS)
      if (data.type === 'TTS') {
        const textToSpeak = data.text;
        const now = Date.now();

        // DEBOUNCE: Prevent double-speaking the same phrase
        if (textToSpeak === lastSpoken.text && now - lastSpoken.time < 2000) {
          return;
        }

        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking) {
          await Speech.stop();
        }
        
        setLastSpoken({ text: textToSpeak, time: now });
        
        setTimeout(() => {
          Speech.speak(textToSpeak, { 
            rate: 0.9, 
            pitch: 1.0,
          });
        }, 30);
      }
      
      if (data.type === 'LOG') {
        setLastLog(data.msg);
      }
    } catch (e) {
      console.log('App Message Error', e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Dashboard onSystemMessage={handleMessage} systemLog={lastLog} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});

registerRootComponent(App);
