import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/Theme';
import { Hand, ArrowRight, Zap, Shield, Sparkles } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';


export default function HomeScreen({ onStart }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).duration(1000)} style={styles.header}>
          <View style={styles.logoContainer}>
            <Hand size={48} color={COLORS.primary} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>ISLRS</Text>
          <Text style={styles.subtitle}>Indian Sign Language Recognition System</Text>
        </Animated.View>

        <View style={styles.features}>
          <FeatureItem 
            icon={<Zap size={24} color={COLORS.secondary} />}
            title="Real-time Recognition"
            description="Instant translation of hand gestures into text."
            delay={400}
          />
          <FeatureItem 
            icon={<Sparkles size={24} color={COLORS.accent} />}
            title="High Accuracy"
            description="Powered by advanced computer vision models."
            delay={600}
          />
          <FeatureItem 
            icon={<Shield size={24} color={COLORS.success} />}
            title="Secure & Local"
            description="Processing happens on your device for privacy."
            delay={800}
          />
        </View>

        <Animated.View entering={FadeInUp.delay(1000)} style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onStart}>
            <Text style={styles.buttonText}>Get Started</Text>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(800)} style={styles.featureItem}>
      <View style={styles.featureIcon}>{icon}</View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  features: {
    marginVertical: SPACING.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  featureDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  footer: {
    marginBottom: SPACING.xl,
  },
  button: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: SPACING.sm,
  },
});
