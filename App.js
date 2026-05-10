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
      
      // Handle Speech for both TTS and GESTURE types to ensure 100% coverage
      if (data.type === 'TTS' || data.type === 'GESTURE') {
        const textToSpeak = data.type === 'TTS' ? data.text : data.value;
        const now = Date.now();

        // Prevent redundant speaking of the same word in short bursts
        if (textToSpeak === lastSpoken.text && now - lastSpoken.time < 1500) {
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
