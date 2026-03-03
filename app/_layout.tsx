import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { Component, useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';

// --- Error Boundary ---
// Catches unhandled JS errors so the app shows a friendly screen instead of crashing to white.
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || 'Unknown error' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Colors.background.primary, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>😕</Text>
          <Text style={{ color: Colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ color: Colors.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            The app ran into an unexpected issue. Please restart the app.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: '' })}
            style={{ backgroundColor: Colors.primary.start, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.text.tertiary, fontSize: 11, marginTop: 20, textAlign: 'center' }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const { width } = Dimensions.get('window');

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const trainSlide = useState(new Animated.Value(-80))[0];
  const titleFade = useState(new Animated.Value(0))[0];
  const subtitleFade = useState(new Animated.Value(0))[0];
  const splashFade = useState(new Animated.Value(1))[0];
  const trainScale = useState(new Animated.Value(0.6))[0];
  const dotPulse = useState(new Animated.Value(0.4))[0];

  useEffect(() => {
    // Train emoji slides in + grows
    Animated.parallel([
      Animated.spring(trainSlide, {
        toValue: 0, tension: 50, friction: 8, useNativeDriver: true,
      }),
      Animated.spring(trainScale, {
        toValue: 1, tension: 50, friction: 8, useNativeDriver: true,
      }),
    ]).start();

    // Title fades in
    setTimeout(() => {
      Animated.timing(titleFade, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }).start();
    }, 350);

    // Subtitle fades in
    setTimeout(() => {
      Animated.timing(subtitleFade, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start();
    }, 700);

    // Gentle dot pulse
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }, 500);

    // Fade out → show app
    setTimeout(() => {
      Animated.timing(splashFade, {
        toValue: 0, duration: 400, useNativeDriver: true,
      }).start(() => setIsReady(true));
    }, 2200);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background.primary }}>
      <StatusBar style="dark" />
      {!isReady && (
        <Animated.View style={[styles.splash, { opacity: splashFade }]}>
          <View style={styles.splashContainer}>
            {/* Top decorative bar */}
            <LinearGradient
              colors={[Colors.primary.start, Colors.primary.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBar}
            />

            <View style={styles.splashContent}>
              {/* Train icon with coral circle */}
              <Animated.View
                style={[
                  styles.trainCircle,
                  {
                    transform: [
                      { translateY: trainSlide },
                      { scale: trainScale },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[Colors.primary.start, Colors.primary.end]}
                  style={styles.trainCircleGradient}
                >
                  <Text style={styles.trainEmoji}>🚂</Text>
                </LinearGradient>
              </Animated.View>

              {/* App name */}
              <Animated.View style={[styles.titleContainer, { opacity: titleFade }]}>
                <Text style={styles.splashTitle}>Rail</Text>
                <Text style={styles.splashTitleAccent}>Mitra</Text>
                <Animated.View
                  style={[styles.liveDot, { opacity: dotPulse }]}
                />
              </Animated.View>

              {/* Tagline */}
              <Animated.Text style={[styles.splashSubtitle, { opacity: subtitleFade }]}>
                Your Train Companion
              </Animated.Text>
            </View>

            {/* Bottom track */}
            <Animated.View style={[styles.trackContainer, { opacity: subtitleFade }]}>
              <View style={styles.track} />
              <View style={styles.trackDots}>
                {[0, 1, 2, 3, 4].map(i => (
                  <View key={i} style={styles.trackDot} />
                ))}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      )}
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right',
          }}
        />
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  splashContent: {
    alignItems: 'center',
    gap: 14,
  },
  trainCircle: {
    marginBottom: 8,
  },
  trainCircleGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary.start,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  trainEmoji: {
    fontSize: 42,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  splashTitle: {
    color: Colors.text.primary,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  splashTitleAccent: {
    color: Colors.primary.start,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success.start,
    marginLeft: 8,
    marginTop: -8,
  },
  splashSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  trackContainer: {
    position: 'absolute',
    bottom: 100,
    width: width * 0.5,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.divider,
    borderRadius: 1,
  },
  trackDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: -3.5,
  },
  trackDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary.light,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
});
