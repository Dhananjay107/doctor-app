import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface SearchIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function SearchIcon({ 
  width = 24, 
  height = 24, 
  color = "#94a3b8" 
}: SearchIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="11"
        cy="11"
        r="8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 21L16.65 16.65"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

