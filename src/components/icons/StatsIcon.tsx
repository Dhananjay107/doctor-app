import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface StatsIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function StatsIcon({ 
  width = 24, 
  height = 24, 
  color = "#f59e0b" 
}: StatsIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3V21H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 16L11 12L15 16L21 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 10H15V16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="7" cy="16" r="1.5" fill={color} />
      <Circle cx="11" cy="12" r="1.5" fill={color} />
      <Circle cx="15" cy="16" r="1.5" fill={color} />
      <Circle cx="21" cy="10" r="1.5" fill={color} />
    </Svg>
  );
}

