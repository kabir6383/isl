import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../constants/Theme';
import { Play, Info, Mic, Hand } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface VideoPlayerGridProps {
  words: string[];
}

export default function VideoPlayerGrid({ words }: VideoPlayerGridProps) {
  if (!words || words.length === 0) {
    return (
      <View style={styles.emptyContainer}>
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

  // Two-Way Mapping: Voice/Sign -> Local Dataset Images
  // We use the first image from User_1 as the representative visual for the sign
  const getSignVisual = (word: string) => {
    const basePath = 'file:///C:/Users/acer/OneDrive/Desktop/islrs/dataset';
    const map: {[key: string]: string} = {
      'agree': `${basePath}/agree/User_1/agree_1_User1_1.jpg`,
      'from': `${basePath}/from/User_1/from_1_User1_1.jpg`,
      'specific': `${basePath}/specific/User_1/specific_1_User1_1.jpg`,
      'you': `${basePath}/you/User_1/you_1_User1_1.jpg`,
    };
    
    // Default placeholder if word not found
    return map[word.toLowerCase()] || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2ZkbHpwNXZocGhzbmhybmhzbmhybmhzbmhybmhzbmhybmhzbmhyJmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKURRndfP6X4M7u/giphy.gif';
  };

  return (
    <View style={styles.grid}>
      <Text style={styles.gridLabel}>DATASET VISUAL REFERENCE</Text>
      <View style={styles.cardsRow}>
        {words.map((word, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.visualWrapper}>
              <Image 
                source={{ uri: getSignVisual(word) }} 
                style={styles.image} 
                resizeMode="cover" 
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>USER_1_SAMPLE</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.wordText}>{word.toUpperCase()}</Text>
            </View>
          </View>
        ))}
        
        {/* Fill remaining slots to maintain grid layout */}
        {[...Array(Math.max(0, 4 - words.length))].map((_, i) => (
          <View key={`fill-${i}`} style={styles.placeholderCard}>
             <Text style={styles.placeholderText}>WAITING...</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    minHeight: 250,
    padding: 20,
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
    alignItems: 'center',
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
    marginBottom: 10,
    letterSpacing: 1,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    position: 'relative',
  },
  image: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 6,
    fontWeight: 'bold',
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
