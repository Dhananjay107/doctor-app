import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface MedicalHistoryIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function MedicalHistoryIcon({ 
  width = 24, 
  height = 24, 
  color = "#06b6d4" 
}: MedicalHistoryIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z"
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
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
    </Svg>
  );
}

