import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const trainSlide = useState(new Animated.Value(-100))[0];
  const titleFade = useState(new Animated.Value(0))[0];
  const subtitleFade = useState(new Animated.Value(0))[0];
  const splashFade = useState(new Animated.Value(1))[0];
  const trainScale = useState(new Animated.Value(0.5))[0];
  const glowPulse = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Step 1: Train emoji slides in + scales up
    Animated.parallel([
      Animated.spring(trainSlide, {
        toValue: 0, tension: 50, friction: 7, useNativeDriver: true,
      }),
      Animated.spring(trainScale, {
        toValue: 1, tension: 50, friction: 7, useNativeDriver: true,
      }),
    ]).start();

    // Step 2: Title appears
    setTimeout(() => {
      Animated.timing(titleFade, {
        toValue: 1, duration: 600, useNativeDriver: true,
      }).start();
    }, 400);

    // Step 3: Subtitle appears
    setTimeout(() => {
      Animated.timing(subtitleFade, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start();
    }, 800);

    // Step 4: Glow pulse
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }, 600);

    // Step 5: Fade out splash → show app
    setTimeout(() => {
      Animated.timing(splashFade, {
        toValue: 0, duration: 400, useNativeDriver: true,
      }).start(() => setIsReady(true));
    }, 2500);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <StatusBar style="light" />
      {!isReady && (
        <Animated.View style={[styles.splash, { opacity: splashFade }]}>
          <LinearGradient
            colors={['#0f0c29', '#302b63', '#24243e']}
            style={styles.splashGradient}
          >
            <View style={styles.splashContent}>
              <Animated.Text
                style={[
                  styles.trainEmoji,
                  {
                    transform: [
                      { translateX: trainSlide },
                      { scale: trainScale },
                    ],
                  },
                ]}
              >
                🚂
              </Animated.Text>
              <Animated.View style={[styles.titleRow, { opacity: titleFade }]}>
                <Text style={styles.splashTitle}>Here Is My Seat</Text>
                <Animated.View
                  style={[
                    styles.glowDot,
                    {
                      opacity: glowPulse,
                      transform: [{ scale: Animated.add(1, Animated.multiply(glowPulse, 0.3 as any)) }],
                    },
                  ]}
                />
              </Animated.View>
              <Animated.Text style={[styles.splashSubtitle, { opacity: subtitleFade }]}>
                Train Seat Availability
              </Animated.Text>
            </View>
            <Animated.View style={[styles.trackLine, { opacity: subtitleFade }]}>
              <View style={styles.track} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  splashGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 12,
  },
  trainEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splashTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  glowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38ef7d',
  },
  splashSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  trackLine: {
    position: 'absolute',
    bottom: 120,
    width: width * 0.6,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
  },
});
