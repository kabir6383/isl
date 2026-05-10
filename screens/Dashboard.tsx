import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions, ScrollView, Animated, Platform, Modal } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/Theme';
import { Shield, Battery, Signal, MessageSquare, User, Camera as CameraIcon, Play, Volume2, Mic, Sliders, Maximize2, RefreshCcw, Activity, Send, Globe, Eye, EyeOff, ChevronDown, ChevronUp, Trash2, AlertTriangle, XCircle, MicOff, Clock, Zap, Cpu, BarChart3, Database, Power, Hand, SwitchCamera, LayoutTemplate } from 'lucide-react-native';
import { Audio } from 'expo-av';
import DetectionEngine, { DetectionEngineRef } from '../components/DetectionEngine';
import VideoPlayerGrid from '../components/VideoPlayerGrid';

const { width, height } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  text: string;
  sender: 'SIGNER' | 'SPEAKER';
  timestamp: string;
}

export default function Dashboard({ onSystemMessage, systemLog }: { onSystemMessage?: (event: any) => void, systemLog?: string }) {
  // State: Core
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSignActive, setIsSignActive] = useState(true);
  const [isVoiceVisible, setIsVoiceVisible] = useState(true);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [voiceCaptions, setVoiceCaptions] = useState('VOICE_STREAM_IDLE');
  
  // State: Communication
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [translationWords, setTranslationWords] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState<string[]>([]);
  
  // State: AI Diagnostics
  const [aiConfidence, setAiConfidence] = useState<any>({});
  
  // Refs
  const detectionRef = useRef<DetectionEngineRef>(null);
  const sosOpacity = useRef(new Animated.Value(0)).current;
  const chatHeight = useRef(new Animated.Value(1)).current;
  const chatScrollRef = useRef<ScrollView>(null);
  const sentenceTimer = useRef<any>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const processedWords = useRef<Set<string>>(new Set());

  // SOS Logic
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

  async function playAlarm() {
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3' }, // Classic Emergency Siren
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setSound(newSound);
    } catch (e) {
      console.warn("SOS Alarm Error", e);
    }
  }

  async function stopAlarm() {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  }

  // Real-time Speech Recognition
  useEffect(() => {
    if (Platform.OS === 'web' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript;
        }
        setVoiceCaptions(interimTranscript);
        
        const words = interimTranscript.toLowerCase().split(/\s+/);
        const known = ['agree', 'from', 'specific', 'you'];
        
        words.forEach(word => {
          if (known.includes(word) && !processedWords.current.has(word)) {
            processedWords.current.add(word);
            addChatMessage(word, 'SPEAKER');
            setTranslationWords(prev => Array.from(new Set([...prev, word])).slice(-10));
          }
        });
      };

      recognition.onstart = () => { setIsListening(true); processedWords.current.clear(); };
      recognition.onend = () => { setIsListening(false); if (timerRef.current) clearTimeout(timerRef.current); };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else {
      processedWords.current.clear();
      setVoiceCaptions('STREAMING...');
      recognitionRef.current.start();
      timerRef.current = setTimeout(() => { if (recognitionRef.current) recognitionRef.current.stop(); }, 4000);
    }
  };

  const addChatMessage = (text: string, sender: 'SIGNER' | 'SPEAKER') => {
    // Prevent duplicate consecutive messages
    setChatMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].text === text.toUpperCase() && prev[prev.length - 1].sender === sender) {
        return prev;
      }
      
      const newMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: text.toUpperCase(),
        sender,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      const next = [...prev, newMessage].slice(-20);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
      return next;
    });
  };

  const clearHistory = () => {
    setChatMessages([]);
    setTranslationWords([]);
    setCurrentSentence([]);
    setVoiceCaptions('READY');
    processedWords.current.clear();
  };

  // Masterwork: Gesture Handling
  const clearTimer = useRef<any>(null);

  const onGesture = (gesture: string, index: number, confidence?: number, probs?: any) => {
    if (gesture === 'GESTURE_END') {
      if (sentenceTimer.current) {
        clearTimeout(sentenceTimer.current);
        processSentence();
      }
      return;
    }

    if (gesture === 'CLEAR_HUD' || probs) setAiConfidence(probs || {});
    if (!isSignActive || gesture === 'CLEAR_HUD') return;

    // Reset 10s Auto-Clear Timer on any activity
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      clearHistory();
    }, 10000);

    if (onSystemMessage) {
      onSystemMessage({ nativeEvent: { data: JSON.stringify({ type: 'GESTURE', value: gesture }) } } as any);
    }

    setCurrentSentence(prev => {
      // De-duplicate: Don't add the same word twice consecutively in a short window
      if (prev.length > 0 && prev[prev.length - 1] === gesture) return prev;
      
      const next = [...prev, gesture];
      if (sentenceTimer.current) clearTimeout(sentenceTimer.current);
      sentenceTimer.current = setTimeout(() => {
        processSentence(next);
      }, 2500); // 2.5s timeout for natural transitions
      return next;
    });
  };

  const processSentence = (targetNext?: string[]) => {
    if (sentenceTimer.current) {
      clearTimeout(sentenceTimer.current);
      sentenceTimer.current = null;
    }
    
    setCurrentSentence(prev => {
      const sentenceToProcess = targetNext || prev;
      if (sentenceToProcess.length === 0) return [];
      
      const finalPhrase = sentenceToProcess.join(' ');
      addChatMessage(finalPhrase, 'SIGNER');
      
      // Send TTS - Move outside or use a small delay to ensure it's unique
      if (onSystemMessage) {
        onSystemMessage({ nativeEvent: { data: JSON.stringify({ type: 'TTS', text: finalPhrase }) } } as any);
      }
      
      setTranslationWords(p => Array.from(new Set([...p, ...sentenceToProcess])).slice(-10));
      return []; // Reset sentence
    });
  };

  const toggleMasterPower = () => {
    const newState = !isSignActive;
    setIsSignActive(newState);
    detectionRef.current?.setCameraActive(newState);
  };

  const isAndroid = Platform.OS === 'android';
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
            {/* Android View Toggles - Now Under Brand Name */}
            {isAndroid && (
              <View style={styles.compactToggleRow}>
                <TouchableOpacity 
                  style={[styles.compactToggleBtn, isVoiceVisible && styles.compactToggleBtnActive]} 
                  onPress={() => setIsVoiceVisible(!isVoiceVisible)}
                >
                  {isVoiceVisible ? <Eye size={10} color="white" /> : <EyeOff size={10} color="white" />}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.compactToggleBtn, isHistoryVisible && styles.compactToggleBtnActive]} 
                  onPress={() => setIsHistoryVisible(!isHistoryVisible)}
                >
                  {isHistoryVisible ? <MessageSquare size={10} color="white" /> : <EyeOff size={10} color="white" />}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <View style={styles.topRightActions}>
          <TouchableOpacity style={styles.clearHeaderBtn} onPress={clearHistory}>
            <Trash2 size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn} onPress={() => setIsSOSActive(true)}>
            <AlertTriangle size={14} color="white" />
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainWrapper}>
        <View style={[styles.dualViewSection, isAndroid && styles.androidDualView, { flex: 4 }]}>
          
          <View style={[
            styles.masterPanel, 
            isAndroid && styles.androidPanel,
            isFullScreen && { flex: 1 }
          ]}>
            <View style={styles.streamFrame}>
              <DetectionEngine ref={detectionRef} onGestureDetected={onGesture} onSystemMessage={onSystemMessage} />
              
              {/* Live Gesture Caption Overlay */}
              {isSignActive && currentSentence.length > 0 && (
                <View style={styles.liveCaptionOverlay}>
                  <View style={styles.captionBackground}>
                    <Text style={styles.liveCaptionText}>
                      {currentSentence.join(' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Camera Switcher */}
              {isSignActive && (
                <TouchableOpacity 
                  style={styles.floatingSwitchBtn} 
                  onPress={() => detectionRef.current?.switchCamera()}
                >
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

          {/* Dynamic Voice Panel */}
          {(!isAndroid || isVoiceVisible) && (
            <View style={[styles.masterPanel, isAndroid && styles.androidPanel]}>
              <View style={styles.visualsFrame}><VideoPlayerGrid words={translationWords} /></View>
              <View style={styles.proVoicePanel}>
                <TouchableOpacity style={[styles.proVoiceBtn, isListening && styles.proVoiceBtnActive]} onPress={toggleListening}>
                  {isListening ? <Activity size={20} color="white" /> : <Zap size={20} color="white" />}
                  <Text style={styles.proVoiceBtnText}>{isListening ? 'LISTENING_ACTIVE' : 'INITIALIZE_VOICE'}</Text>
                </TouchableOpacity>
                <View style={styles.voiceStatus}>
                   <Text style={styles.voiceStatusText}>{voiceCaptions.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )}

        </View>

        {/* Dynamic Caption Section */}
        {isHistoryVisible && (
          <Animated.View style={[styles.chatSection, { flex: isAndroid ? 0.3 : 0.4 }]}>
            <View style={styles.chatHeader}>
              <BarChart3 size={16} color={COLORS.textMuted} />
              <Text style={styles.chatTitle}>CAPTION</Text>
              <View style={styles.chatActions}>
                <TouchableOpacity onPress={clearHistory} style={styles.historyClearBtn}>
                  <Trash2 size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsHistoryVisible(false)} style={styles.historyClearBtn}>
                  <EyeOff size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView ref={chatScrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
              {chatMessages.map(msg => (
                <View key={msg.id} style={[styles.glassBubble, msg.sender === 'SIGNER' ? styles.signerGlass : styles.speakerGlass]}>
                  <View style={styles.bubbleHeader}>
                    <Database size={8} color={COLORS.textMuted} />
                    <Text style={styles.bubbleSource}>{msg.sender} • {msg.timestamp}</Text>
                  </View>
                  <Text style={[styles.msgText, msg.sender === 'SIGNER' ? styles.signerText : styles.speakerText]}>{msg.text}</Text>
                </View>
              ))}
              
              {currentSentence.length > 0 && (
                <View style={[styles.glassBubble, styles.signerGlass, styles.pendingBubble]}>
                  <View style={styles.bubbleHeader}>
                    <Activity size={8} color={COLORS.primary} />
                    <Text style={[styles.bubbleSource, {color: COLORS.primary}]}>LIVE...</Text>
                  </View>
                  <Text style={[styles.msgText, styles.signerText]}>{currentSentence.join(' ').toUpperCase()}</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}

        {!isHistoryVisible && (
          <TouchableOpacity 
            style={styles.showCaptionBtn} 
            onPress={() => setIsHistoryVisible(true)}
          >
            <MessageSquare size={16} color="white" />
            <Text style={styles.showCaptionText}>SHOW CAPTION</Text>
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
  compactToggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  compactToggleBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  compactToggleBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: COLORS.primary },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  clearHeaderBtn: { padding: 10 },
  sosBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  mainWrapper: { flex: 1, padding: 5 },
  dualViewSection: { flex: 2, flexDirection: 'row', gap: 15 },
  androidDualView: { flexDirection: 'column' },
  androidPanel: { flex: 1.5, minHeight: 350 },
  masterPanel: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  panelHeader: { height: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginRight: 12 },
  panelTitle: { color: '#94a3b8', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, flex: 1 },
  floatingSwitchBtn: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 50 },
  proVoiceBtn: { height: 48, backgroundColor: COLORS.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  proVoiceBtnActive: { backgroundColor: COLORS.success },
  proVoiceBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11, letterSpacing: 1, marginLeft: 10 },
  voiceStatus: { height: 25, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  voiceStatusText: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  liveCaptionOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  captionBackground: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  liveCaptionText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  chatSection: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  chatHeader: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  chatTitle: { color: '#94a3b8', fontSize: 8, fontWeight: 'bold', marginLeft: 10, flex: 1, letterSpacing: 1 },
  chatActions: { flexDirection: 'row', gap: 5 },
  historyClearBtn: { padding: 10 },
  showCaptionBtn: {
    height: 40,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  showCaptionText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 10,
    letterSpacing: 1,
  },
  chatScroll: { flex: 1 },
  chatContent: { padding: 15 },
  glassBubble: { padding: 12, borderRadius: 14, marginBottom: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
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
  proVoicePanel: { padding: 15, backgroundColor: 'rgba(0,0,0,0.3)', borderTopWidth: 1, borderTopColor: '#334155' },
});
