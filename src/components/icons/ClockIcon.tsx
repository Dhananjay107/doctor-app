import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface ClockIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function ClockIcon({ 
  width = 24, 
  height = 24, 
  color = "#f59e0b" 
}: ClockIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6V12L16 14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

