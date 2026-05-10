import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import { AlertCircle } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, interpolateColor } from 'react-native-reanimated';
import { Audio } from 'expo-av';

export default function SOSButton({ active, onPress }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const soundRef = React.useRef(null);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      playHelpAudio();
    } else {
      scale.value = withTiming(1);
      stopHelpAudio();
    }
  }, [active]);

  const playHelpAudio = async () => {
    try {
      // In a real app, you would load an actual help audio file
      // console.log('Playing Emergency Audio: HELP NEEDED!');
    } catch (error) {
      console.log('Error playing SOS audio', error);
    }
  };

  const stopHelpAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: active ? COLORS.accent : COLORS.background,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <AlertCircle size={20} color={active ? 'white' : COLORS.accent} />
        <Text style={[styles.text, active && styles.textActive]}>SOS</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  text: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.accent,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
  },
  textActive: {
    color: 'white',
  },
});
