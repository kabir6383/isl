import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/Theme';
import { X, Mic, Volume2, Settings, RefreshCcw } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import * as Speech from 'expo-speech';

const { width, height } = Dimensions.get('window');


export default function RecognitionScreen({ onBack }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [recognizedText, setRecognizedText] = useState('Waiting for gesture...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleSpeak = () => {
    if (recognizedText && recognizedText !== 'Waiting for gesture...') {
      Speech.speak(recognizedText);
    }
  };

  const mockRecognition = () => {
    setIsProcessing(true);
    // Simulate recognition delay
    setTimeout(() => {
      const gestures = ['Namaste', 'Thank You', 'Hello', 'Help', 'I Love You'];
      const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
      setRecognizedText(randomGesture);
      setConfidence(Math.random() * 0.2 + 0.8); // 80-100% confidence
      setIsProcessing(false);
    }, 1500);
  };

  if (!permission) {
    return <View style={styles.loadingContainer}><Text style={styles.text}>Requesting permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="front">
        <SafeAreaView style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={onBack}>
              <X size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isProcessing ? COLORS.warning : COLORS.success }]} />
              <Text style={styles.statusText}>{isProcessing ? 'Processing...' : 'Live'}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Target Guide */}
          <View style={styles.guideContainer}>
            <View style={styles.guideCornerTopLeft} />
            <View style={styles.guideCornerTopRight} />
            <View style={styles.guideCornerBottomLeft} />
            <View style={styles.guideCornerBottomRight} />
            {isProcessing && (
              <Animated.View entering={FadeIn} style={styles.scanLine} />
            )}
          </View>

          {/* Results Area */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Recognition Result</Text>
              {confidence > 0 && (
                <Text style={styles.confidenceText}>{(confidence * 100).toFixed(1)}% match</Text>
              )}
            </View>
            
            <View style={styles.resultBox}>
              <Text style={styles.recognizedText}>{recognizedText}</Text>
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleSpeak}>
                  <Volume2 size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={mockRecognition}>
                  <RefreshCcw size={20} color={COLORS.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>Position your hand within the guide for better accuracy.</Text>
            </View>
          </Animated.View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  guideContainer: {
    alignSelf: 'center',
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 0,
    position: 'relative',
  },
  guideCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderTopLeftRadius: 20,
  },
  guideCornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderTopRightRadius: 20,
  },
  guideCornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 20,
  },
  guideCornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderBottomRightRadius: 20,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  resultsContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confidenceText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  recognizedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  resultActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hintContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  hintText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
