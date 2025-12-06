import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LogBox } from 'react-native';

// Suppress the pointerEvents deprecation warning from React Navigation
LogBox.ignoreLogs(['props.pointerEvents is deprecated. Use style.pointerEvents']);

export default function CustomTabBar(props: BottomTabBarProps) {
  return <BottomTabBar {...props} />;
}
