import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface PatientIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function PatientIcon({ 
  width = 24, 
  height = 24, 
  color = "#10b981" 
}: PatientIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8"
        r="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 21V19C6 16.7909 7.79086 15 10 15H14C16.2091 15 18 16.7909 18 19V21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 12V14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

