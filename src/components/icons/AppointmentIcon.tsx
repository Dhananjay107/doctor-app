import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface AppointmentIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function AppointmentIcon({ 
  width = 24, 
  height = 24, 
  color = "#0ea5e9" 
}: AppointmentIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 2V6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 2V6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 10H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8" cy="15" r="1" fill={color} />
      <Circle cx="12" cy="15" r="1" fill={color} />
      <Circle cx="16" cy="15" r="1" fill={color} />
    </Svg>
  );
}

