import React from "react";
import Svg, { Path, Ellipse } from "react-native-svg";

interface MedicineIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function MedicineIcon({ 
  width = 24, 
  height = 24, 
  color = "#8b5cf6" 
}: MedicineIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Ellipse
        cx="12"
        cy="12"
        rx="8"
        ry="4"
        fill={color}
        opacity="0.2"
      />
      <Path
        d="M4 12C4 8.68629 7.58172 6 12 6C16.4183 6 20 8.68629 20 12C20 15.3137 16.4183 18 12 18C7.58172 18 4 15.3137 4 12Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 12C4 15.3137 7.58172 18 12 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 12C20 8.68629 16.4183 6 12 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 2V6M12 18V22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

