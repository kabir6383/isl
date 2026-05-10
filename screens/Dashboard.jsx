import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Animated, Platform, Modal, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/Theme';
import { Shield, Battery, Signal, MessageSquare, User, Camera as CameraIcon, Play, Volume2, Mic, Sliders, Maximize2, RefreshCcw, Activity, Send, Globe, Eye, EyeOff, ChevronDown, ChevronUp, Trash2, AlertTriangle, XCircle, MicOff, Clock, Zap, Cpu, BarChart3, Database, Power, Hand, SwitchCamera, LayoutTemplate } from 'lucide-react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import DetectionEngine from '../components/DetectionEngine';
import VideoPlayerGrid from '../components/VideoPlayerGrid';

const API_URL = 'http://localhost:5000/api';

export default function Dashboard({ onSystemMessage, systemLog }) {
  // State: Core
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSignActive, setIsSignActive] = useState(true);
  const [isVoiceVisible, setIsVoiceVisible] = useState(true);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [voiceCaptions, setVoiceCaptions] = useState('VOICE_STREAM_IDLE');
  
  // State: Communication
  const [chatMessages, setChatMessages] = useState([]);
  const [translationWords, setTranslationWords] = useState([]);
  const [persistentTranslationWords, setPersistentTranslationWords] = useState([]);
  const [currentSentence, setCurrentSentence] = useState([]);
  const [activeCaption, setActiveCaption] = useState('');
  
  // State: AI Diagnostics
  const [aiConfidence, setAiConfidence] = useState({});
  
  // Refs
  const detectionRef = useRef(null);
  const sosOpacity = useRef(new Animated.Value(0)).current;
  const chatScrollRef = useRef(null);
  const sentenceTimer = useRef(null);
  const [sound, setSound] = useState(null);
  const timerRef = useRef(null);
  const processedWords = useRef(new Set());

  const clearPersistentHistory = () => {
    setPersistentTranslationWords([]);
  };

  // Load History from Backend
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/history`);
      setChatMessages(response.data.map(item => ({
        id: item._id,
        text: item.text.toUpperCase(),
        sender: item.sender,
        timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
    } catch (error) {
      console.error('Fetch History Error', error);
    }
  };

  const saveToHistory = async (text, sender) => {
    try {
      await axios.post(`${API_URL}/history`, { text, sender });
    } catch (error) {
      console.error('Save History Error', error);
    }
  };

  // SOS Logic
  const soundObject = useRef(new Audio.Sound());

  useEffect(() => {
    if (isSOSActive) {
      playAlarm();
      Animated.loop(Animated.sequence([
        Animated.timing(sosOpacity, { toValue: 0.5, duration: 400, useNativeDriver: false }),
        Animated.timing(sosOpacity, { toValue: 0, duration: 400, useNativeDriver: false }),
      ])).start();
    } else {
      stopAlarm();
      sosOpacity.setValue(0);
    }
  }, [isSOSActive]);

  useEffect(() => {
    soundObject.current.loadAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3' },
      { shouldPlay: false, isLooping: true, volume: 1.0 }
    ).catch(e => console.warn("Audio Load Error", e));
    return () => { soundObject.current.unloadAsync(); };
  }, []);

  async function playAlarm() { try { await soundObject.current.replayAsync(); } catch (e) {} }
  async function stopAlarm() { try { await soundObject.current.stopAsync(); } catch (e) {} }

  const toggleListening = () => {
    if (isListening) {
      detectionRef.current?.stopVoice();
      setIsListening(false);
    } else {
      processedWords.current.clear();
      setVoiceCaptions('STREAMING...');
      detectionRef.current?.startVoice();
      setIsListening(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        detectionRef.current?.stopVoice();
        setIsListening(false);
      }, 4000);
    }
  };

  const addChatMessage = (text, sender) => {
    setChatMessages(prev => {
      if (prev.length > 0 && prev[0].text === text.toUpperCase() && prev[0].sender === sender) return prev;
      
      const newMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: text.toUpperCase(),
        sender,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      saveToHistory(text, sender);
      const next = [newMessage, ...prev].slice(0, 20);
      return next;
    });
  };

  const clearHistory = () => {
    setChatMessages([]);
    setTranslationWords([]);
    setCurrentSentence([]);
    setActiveCaption('');
    setVoiceCaptions('READY');
    processedWords.current.clear();
  };

  const clearSignTimer = useRef(null);
  const updateTranslationWords = (word) => {
    setPersistentTranslationWords(prev => Array.from(new Set([...prev, word])).slice(-20));
    setTranslationWords(prev => {
      const next = Array.from(new Set([...prev, word])).slice(-10);
      if (clearSignTimer.current) clearTimeout(clearSignTimer.current);
      clearSignTimer.current = setTimeout(() => {
        setTranslationWords([]);
      }, 10000); // 10 second auto-clear for the "Stream" tab
      return next;
    });
  };

  const onGesture = (gesture, index, confidence, probs) => {
    if (typeof gesture === 'object') {
      if (gesture.type === 'VOICE_RESULT') {
        const text = gesture.value.toLowerCase();
        setVoiceCaptions(text);
        
        const datasetSigns = detectionRef.current?.getModelClasses() || [];
        
        // 1. Check for full phrase matches first (e.g., "how are you")
        datasetSigns.forEach(sign => {
          if (sign.length > 3 && text.includes(sign.toLowerCase()) && !processedWords.current.has(sign)) {
            processedWords.current.add(sign);
            addChatMessage(sign, 'SPEAKER');
            updateTranslationWords(sign);
          }
        });

        // 2. Fallback to individual word matches
        const words = text.split(/\s+/);
        words.forEach(word => {
          const isRelevant = datasetSigns.includes(word);
          if (isRelevant && !processedWords.current.has(word)) {
            processedWords.current.add(word);
            addChatMessage(word, 'SPEAKER');
            updateTranslationWords(word);
          }
        });
      } else if (gesture.type === 'VOICE_STATUS') {
        setIsListening(gesture.value === 'LISTENING');
      }
      return;
    }

    if (gesture === 'GESTURE_END') {
      if (sentenceTimer.current) {
        clearTimeout(sentenceTimer.current);
        processSentence();
      }
      return;
    }

    if (gesture === 'CLEAR_HUD' || probs) setAiConfidence(probs || {});
    if (!isSignActive || gesture === 'CLEAR_HUD') return;

    if (onSystemMessage) {
      onSystemMessage({ nativeEvent: { data: JSON.stringify({ type: 'GESTURE', value: gesture }) } });
    }

    setCurrentSentence(prev => {
      if (typeof gesture !== 'string') return prev;
      if (prev.length > 0 && prev[prev.length - 1] === gesture) return prev;
      const next = [...prev, gesture];
      updateTranslationWords(gesture);

      if (sentenceTimer.current) clearTimeout(sentenceTimer.current);
      // Wait 2 seconds of silence before processing the sentence
      sentenceTimer.current = setTimeout(() => {
        processSentence(next);
      }, 2000); 
      return next;
    });
  };

  const processSentence = (targetNext) => {
    if (sentenceTimer.current) {
      clearTimeout(sentenceTimer.current);
      sentenceTimer.current = null;
    }
    
    setCurrentSentence(prev => {
      const sentenceToProcess = targetNext || prev;
      if (sentenceToProcess.length === 0) return [];
      const finalPhrase = sentenceToProcess.join(' ');
      addChatMessage(finalPhrase, 'SIGNER');
      
      if (onSystemMessage) {
        onSystemMessage({ nativeEvent: { data: JSON.stringify({ type: 'TTS', text: finalPhrase }) } });
      }
      
      setTranslationWords(p => Array.from(new Set([...p, ...sentenceToProcess])).slice(-10));
      setActiveCaption(finalPhrase);
      return []; 
    });
  };

  const toggleMasterPower = () => {
    const newState = !isSignActive;
    setIsSignActive(newState);
    detectionRef.current?.setCameraActive(newState);
  };

  const { width: windowWidth } = useWindowDimensions();
  const isMobile = Platform.OS === 'android' || windowWidth < 768;
  const isAndroid = isMobile;
  const isFullScreen = isAndroid && !isVoiceVisible && !isHistoryVisible;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.sosOverlay, { opacity: sosOpacity }]} pointerEvents="none" />
      <Modal visible={isSOSActive} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconContainer}><AlertTriangle size={48} color="white" /></View>
            <Text style={styles.alertTitle}>SOS ACTIVE</Text>
            <TouchableOpacity style={styles.dismissBtn} onPress={() => setIsSOSActive(false)}>
              <Text style={styles.dismissBtnText}>STOP ALARM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.topBar}>
        <View style={styles.leftBar}>
          <TouchableOpacity 
            style={[styles.logoCircle, !isSignActive && styles.logoCircleOff]} 
            onPress={toggleMasterPower}
          >
            <Power size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.brandText}>ISLRS</Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {isAndroid && (
                <TouchableOpacity 
                  style={[styles.compactToggleBtn, isVoiceVisible && styles.compactToggleBtnActive]} 
                  onPress={() => setIsVoiceVisible(!isVoiceVisible)}
                >
                  {isVoiceVisible ? <Eye size={10} color="white" /> : <EyeOff size={10} color="white" />}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={styles.topRightActions}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => setIsSOSActive(true)}>
            <AlertTriangle size={14} color="white" />
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.mainWrapper}>
        <View style={[styles.dualViewSection, isAndroid && styles.androidDualView, { flex: 4 }]}>
          <View style={[styles.masterPanel, isAndroid && styles.androidPanel, { flex: 3 }, isFullScreen && { flex: 1 }]}>
            <View style={styles.streamFrame}>
              <DetectionEngine ref={detectionRef} onGestureDetected={onGesture} onSystemMessage={onSystemMessage} />
              {isSignActive && currentSentence.length > 0 && (
                <View style={styles.liveCaptionOverlay}>
                  <View style={styles.captionBackground}><Text style={styles.liveCaptionText}>{currentSentence.join(' ').toUpperCase()}</Text></View>
                </View>
              )}
              {isListening && voiceCaptions && (
                <View style={styles.voiceCaptionOverlay}>
                  <View style={styles.voiceCaptionBackground}>
                    <Mic size={14} color={COLORS.success} />
                    <Text style={styles.voiceCaptionText}>{voiceCaptions.toUpperCase()}</Text>
                  </View>
                </View>
              )}
              {isSignActive && (
                <TouchableOpacity style={styles.floatingSwitchBtn} onPress={() => detectionRef.current?.switchCamera()}>
                  <SwitchCamera size={18} color="white" />
                </TouchableOpacity>
              )}
              {!isSignActive && (
                <View style={styles.disabledOverlay}>
                  <Hand size={24} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.disabledText}>SYSTEM OFFLINE</Text>
                </View>
              )}
            </View>
          </View>
          {(!isAndroid || isVoiceVisible) && (
            <View style={[styles.masterPanel, isAndroid && { flex: 1, minHeight: 250 }]}>
              <View style={styles.visualsFrame}>
                <VideoPlayerGrid words={translationWords} />
                <TouchableOpacity 
                  style={[styles.floatingVoiceBtn, isListening && styles.proVoiceBtnActive]} 
                  onPress={toggleListening}
                >
                  {isListening ? <Activity size={20} color="white" /> : <Mic size={20} color="white" />}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        {isHistoryVisible && (
          <Animated.View style={[styles.chatSection, { flex: isAndroid ? 0.3 : 0.4 }]}>
            <View style={styles.chatHeader}>
              <BarChart3 size={16} color={COLORS.textMuted} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.chatTitle}>HISTORY :</Text>
              </View>
              <View style={styles.chatActions}>
                <TouchableOpacity onPress={clearHistory} style={styles.historyClearBtn}>
                  <Trash2 size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsHistoryVisible(false)} style={styles.historyClearBtn}>
                  <EyeOff size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView ref={chatScrollRef} horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
              {currentSentence.length > 0 && (
                <View style={[styles.glassBubble, styles.signerGlass, styles.pendingBubble, styles.horizontalBubble]}>
                  <View style={styles.bubbleHeader}>
                    <Activity size={8} color={COLORS.primary} />
                    <Text style={[styles.bubbleSource, {color: COLORS.primary}]}>LIVE...</Text>
                  </View>
                  <Text style={[styles.msgText, styles.signerText]}>{currentSentence.join(', ').toUpperCase()}</Text>
                </View>
              )}
              {chatMessages.map(msg => (
                <View key={msg.id} style={[styles.glassBubble, msg.sender === 'SIGNER' ? styles.signerGlass : styles.speakerGlass, styles.horizontalBubble]}>
                  <View style={styles.bubbleHeader}>
                    <Database size={8} color={COLORS.textMuted} />
                    <Text style={styles.bubbleSource}>{msg.sender} • {msg.timestamp}</Text>
                  </View>
                  <Text style={[styles.msgText, msg.sender === 'SIGNER' ? styles.signerText : styles.speakerText]}>{msg.text}</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}
        {!isHistoryVisible && (
          <TouchableOpacity style={styles.showCaptionBtn} onPress={() => setIsHistoryVisible(true)}>
            <MessageSquare size={16} color="white" />
            <Text style={styles.showCaptionText}>SHOW HISTORY</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  sosOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.accent, zIndex: 1000 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  alertCard: { width: 300, backgroundColor: '#1e1e1e', borderRadius: 24, padding: 30, alignItems: 'center', borderTopWidth: 4, borderColor: COLORS.accent },
  alertIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  dismissBtn: { width: '100%', height: 45, backgroundColor: COLORS.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  dismissBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  topBar: { height: 85, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  leftBar: { flexDirection: 'row', alignItems: 'center' },
  logoCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  logoCircleOff: { backgroundColor: '#475569' },
  brandText: { color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  compactToggleBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginTop: 4 },
  compactToggleBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: COLORS.primary },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  sosBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  mainWrapper: { flex: 1, padding: 5, gap: 25 },
  dualViewSection: { flex: 2, flexDirection: 'row', gap: 25 },
  androidDualView: { flexDirection: 'column', gap: 10 },
  androidPanel: { flex: 1.5, minHeight: 350 },
  masterPanel: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  floatingSwitchBtn: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 50 },
  floatingVoiceBtn: { position: 'absolute', bottom: 15, right: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  proVoiceBtnActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  liveCaptionOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  captionBackground: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  liveCaptionText: { color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  voiceCaptionOverlay: { position: 'absolute', top: 80, left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  voiceCaptionBackground: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.2)', borderWidth: 1, borderColor: COLORS.success },
  voiceCaptionText: { color: 'white', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  chatSection: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  chatHeader: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  chatTitle: { color: '#94a3b8', fontSize: 8, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  chatActions: { flexDirection: 'row', gap: 5 },
  historyClearBtn: { padding: 10 },
  showCaptionBtn: { height: 40, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  showCaptionText: { color: 'white', fontSize: 9, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: 15, flexDirection: 'row', gap: 12 },
  glassBubble: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  horizontalBubble: { minWidth: 200, maxWidth: 300 },
  pendingBubble: { borderColor: COLORS.primary, borderStyle: 'dashed' },
  signerGlass: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  speakerGlass: { borderLeftWidth: 4, borderLeftColor: COLORS.highlight },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 5 },
  bubbleSource: { color: COLORS.textMuted, fontSize: 6, fontWeight: 'bold', letterSpacing: 1 },
  msgText: { fontSize: 16, fontWeight: 'bold' },
  signerText: { color: 'white' },
  speakerText: { color: COLORS.highlight },
  streamFrame: { flex: 1, backgroundColor: '#000', position: 'relative' },
  disabledOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  disabledText: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 'bold', marginTop: 10, letterSpacing: 2 },
  visualsFrame: { flex: 1, padding: 10 },
});
