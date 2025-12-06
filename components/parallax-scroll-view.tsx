import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet, useColorScheme, Animated, ScrollView } from 'react-native';
import { useRef } from 'react';

import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colorScheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
  const backgroundColor = Colors[colorScheme].background;
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
    outputRange: [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
    outputRange: [2, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <ScrollView
      style={{ backgroundColor, flex: 1 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      })}>
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: headerBackgroundColor[colorScheme] },
          {
            transform: [
              { translateY: headerTranslateY },
              { scale: headerScale },
            ],
          },
        ]}>
        {headerImage}
      </Animated.View>
      <ThemedView style={styles.content}>{children}</ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
});
