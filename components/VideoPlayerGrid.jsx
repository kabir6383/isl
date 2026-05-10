import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../constants/Theme';
import { Play, Info, Mic, Hand, Book, History, Trash2 } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');


const SIGN_RESOURCES = {
  'good': { type: 'video', source: require('../assets/sign_good.mp4') },
  'morning': { type: 'video', source: require('../assets/sign_morning.mp4') },
  'how are you': { type: 'image', source: require('../assets/sign_how_are_you.png') },
  'agree': { type: 'image', source: require('../assets/sign_agree.jpg') },
  'from': { type: 'image', source: require('../assets/sign_from.jpg') },
  'specific': { type: 'image', source: require('../assets/sign_specific.jpg') },
  'you': { type: 'image', source: require('../assets/sign_you.jpg') },
};

export default function VideoPlayerGrid({ words, persistentWords = [], onClearHistory }) {
  const [viewMode, setViewMode] = useState('STREAM');

  const displayWords = viewMode === 'LIBRARY' ? persistentWords : words;

  if (viewMode === 'STREAM' && (!words || words.length === 0)) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.tabHeader}>
           <Text style={styles.gridLabel}></Text>
           <TouchableOpacity onPress={() => setViewMode('LIBRARY')} style={styles.libraryToggle}>
              <Book size={14} color={COLORS.primary} />
              <Text style={styles.libraryToggleText}>LIBRARY</Text>
           </TouchableOpacity>
        </View>
        <View style={styles.emptyInner}>
          <View style={styles.iconCircle}>
            <Hand size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyText}>SIGN DICTIONARY</Text>
          <Text style={styles.emptySub}>Awaiting Voice or Sign input...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <View style={styles.tabHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {viewMode === 'LIBRARY' && (
            <TouchableOpacity onPress={onClearHistory} style={styles.deleteBtn}>
              <Trash2 size={12} color={COLORS.accent} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          onPress={() => setViewMode(viewMode === 'STREAM' ? 'LIBRARY' : 'STREAM')} 
          style={styles.libraryToggle}
        >
          {viewMode === 'STREAM' ? (
            <>
              <Book size={14} color={COLORS.primary} />
              <Text style={styles.libraryToggleText}>LIBRARY</Text>
            </>
          ) : (
            <>
              <History size={14} color={COLORS.highlight} />
              <Text style={[styles.libraryToggleText, {color: COLORS.highlight}]}>STREAM</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.cardsRow}
        showsVerticalScrollIndicator={false}
      >
        {displayWords.map((word, index) => {
          const resource = SIGN_RESOURCES[word.toLowerCase().trim()];

          return (
            <View key={`${viewMode}-${word}-${index}`} style={styles.card}>
              <View style={styles.visualWrapper}>
                {resource ? (
                  resource.type === 'video' ? (
                    <Video
                      source={resource.source}
                      style={styles.image}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={true}
                      isLooping={true}
                      isMuted={true}
                      useNativeControls={false}
                      playsInline={true}
                    />
                  ) : (
                    <Image 
                      source={resource.source} 
                      style={styles.image} 
                      resizeMode="contain"
                    />
                  )
                ) : (
                  <View style={styles.placeholderCard}><Text style={styles.placeholderText}>NO MEDIA</Text></View>
                )}
              </View>
              <View style={styles.cardFooter}>
                 <Text style={styles.wordText}>{word.toUpperCase()}</Text>
              </View>
            </View>
          );
        })}
        
        {viewMode === 'STREAM' && words.length < 4 && [...Array(4 - words.length)].map((_, i) => (
          <View key={`fill-${i}`} style={styles.placeholderCard}>
             <Text style={styles.placeholderText}>WAITING...</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: 'rgba(0,0,0,0.3)',
    minHeight: 250,
    padding: 15,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  libraryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  libraryToggleText: {
    color: COLORS.primary,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 5,
  },
  grid: {
    flex: 1,
  },
  gridLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visualWrapper: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    alignSelf: 'center',
  },
  cardFooter: {
    padding: 10,
    backgroundColor: COLORS.surface,
  },
  wordText: {
    color: COLORS.highlight,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholderCard: {
    width: '48%',
    aspectRatio: 4/3,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.05)',
    fontSize: 7,
    fontWeight: 'bold',
  }
});
