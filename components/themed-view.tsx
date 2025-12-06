import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

type ThemedViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ThemedView({ children, style }: ThemedViewProps) {
  const theme = useColorScheme() ?? 'light';
  const backgroundColor = Colors[theme].background;

  return <View style={[{ backgroundColor }, style]}>{children}</View>;
}

