import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedLogoProps {
  size?: number;
  animated?: boolean;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ size = 120, animated = true }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;

    // Native driver not supported on web
    const useNative = Platform.OS !== 'web';

    // Continuous rotation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: useNative,
      })
    );

    // Scale pulse
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    rotateAnimation.start();
    scaleAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      scaleAnimation.stop();
      pulseAnimation.stop();
    };
  }, [animated, rotateAnim, scaleAnim, pulseAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer rotating ring */}
      <Animated.View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate }],
          },
        ]}
      >
        <LinearGradient
          colors={['#0066FF', '#00BFFF', '#0066FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ringGradient}
        />
      </Animated.View>

      {/* Middle pulsing ring */}
      <Animated.View
        style={[
          styles.middleRing,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#00C853', '#00E676', '#00C853']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ringGradient}
        />
      </Animated.View>

      {/* Center medical cross */}
      <Animated.View
        style={[
          styles.centerContainer,
          {
            width: size * 0.6,
            height: size * 0.6,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#0066FF', '#00C853', '#00BFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.crossContainer}
        >
          {/* Medical Cross */}
          <View style={styles.cross}>
            {/* Vertical bar */}
            <View style={[styles.crossBar, styles.crossVertical]} />
            {/* Horizontal bar */}
            <View style={[styles.crossBar, styles.crossHorizontal]} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Decorative dots */}
      <Animated.View
        style={[
          styles.dot,
          styles.dotTop,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={[styles.dotInner, { backgroundColor: '#0066FF' }]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.dot,
          styles.dotRight,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={[styles.dotInner, { backgroundColor: '#00C853' }]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.dot,
          styles.dotBottom,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={[styles.dotInner, { backgroundColor: '#0066FF' }]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.dot,
          styles.dotLeft,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={[styles.dotInner, { backgroundColor: '#00C853' }]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  ringGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  middleRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  crossContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  },
  cross: {
    width: '60%',
    height: '60%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  crossBar: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  crossVertical: {
    width: 8,
    height: '100%',
  },
  crossHorizontal: {
    width: '100%',
    height: 8,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotTop: {
    top: 0,
    alignSelf: 'center',
  },
  dotRight: {
    right: 0,
    alignSelf: 'center',
  },
  dotBottom: {
    bottom: 0,
    alignSelf: 'center',
  },
  dotLeft: {
    left: 0,
    alignSelf: 'center',
  },
});

export default AnimatedLogo;

