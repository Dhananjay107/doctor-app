import React from "react";
import Svg, { Path } from "react-native-svg";

interface CheckIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function CheckIcon({ 
  width = 24, 
  height = 24, 
  color = "#22c55e" 
}: CheckIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

