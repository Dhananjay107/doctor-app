import React from "react";
import Svg, { Path } from "react-native-svg";

interface RefreshIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function RefreshIcon({ 
  width = 24, 
  height = 24, 
  color = "#0ea5e9" 
}: RefreshIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 4V10H7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M23 20V14H17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.49 9C20.0173 7.56678 19.2181 6.2854 18.1509 5.27541C17.0837 4.26542 15.7815 3.55976 14.3708 3.22426C12.9601 2.88876 11.4867 2.93434 10.0998 3.35677C8.71286 3.77921 7.4609 4.5649 6.46 5.64L1 10M23 14L17.54 18.36C16.5391 19.4351 15.2871 20.2208 13.9002 20.6432C12.5133 21.0657 11.0399 21.1112 9.62918 20.7757C8.21847 20.4402 6.91626 19.7346 5.84909 18.7246C4.78192 17.7146 3.98274 16.4332 3.51 15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

