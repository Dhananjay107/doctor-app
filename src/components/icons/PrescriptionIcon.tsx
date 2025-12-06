import React from "react";
import Svg, { Path, Circle, Line } from "react-native-svg";

interface PrescriptionIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function PrescriptionIcon({ 
  width = 24, 
  height = 24, 
  color = "#8b5cf6" 
}: PrescriptionIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 2V6H15V2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 2H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="12" r="1.5" fill={color} />
      <Circle cx="9" cy="16" r="1.5" fill={color} />
      <Path
        d="M13 11L17 15M17 11L13 15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

