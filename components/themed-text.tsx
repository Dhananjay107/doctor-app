import { type ReactNode } from 'react';
import { type StyleProp, type TextStyle, Text, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

type ThemedTextProps = {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  type?: 'default' | 'defaultSemiBold' | 'title' | 'subtitle';
};

export function ThemedText({ children, style, type = 'default' }: ThemedTextProps) {
  const theme = useColorScheme() ?? 'light';
  const color = Colors[theme].text;

  const textStyle: StyleProp<TextStyle> = {
    color,
    ...(type === 'defaultSemiBold' && { fontWeight: '600' }),
    ...(type === 'title' && { fontSize: 24, fontWeight: 'bold' }),
    ...(type === 'subtitle' && { fontSize: 18, fontWeight: '500' }),
  };

  return <Text style={[textStyle, style]}>{children}</Text>;
}

