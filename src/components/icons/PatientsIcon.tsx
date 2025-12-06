import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface PatientsIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function PatientsIcon({ 
  width = 24, 
  height = 24, 
  color = "#10b981" 
}: PatientsIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      {/* First person */}
      <Circle
        cx="9"
        cy="7"
        r="3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 21V19C3 16.7909 4.79086 15 7 15H11C13.2091 15 15 16.7909 15 19V21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second person (overlapping) */}
      <Circle
        cx="15"
        cy="7"
        r="3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 21V19C9 16.7909 10.7909 15 13 15H17C19.2091 15 21 16.7909 21 19V21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

