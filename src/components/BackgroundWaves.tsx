import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const BackgroundWaves: React.FC = () => {
  const { accent, accentRgb, accentLight } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">

      <div        className="absolute inset-0 transition-colors duration-700"
    style={{
          background: `linear-gradient(180deg, rgba(${accentRgb}, 0.13) 0%, rgba(${accentRgb}, 0.04) 42%,#f8fafc 100%)`,
        }}
      />

      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[950px] h-[500px] blur-3xl rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(${accentRgb}, 0.22) 38%, transparent 75%)`,
        }}
      />

      <div
        className="absolute -bottom-32 -left-24 w-[600px] h-[450px] blur-3xl rounded-full pointer-events-none opacity-40 transition-all duration-700"
        style={{
          background: `radial-gradient(circle, rgba(${accentRgb}, 0.18) 0%, transparent 70%)`,
        }}
      />

      <svg        className="absolute top-12 -left-20 w-[420px] h-[180px] filter drop-shadow-sm opacity-70 transition-colors duration-700"
        viewBox="0 0 320 160"
        style={{ color: `rgba(${accentRgb}, 0.12)` }}
        fill="currentColor"
      >
        <path d="M 60,120 Q 20,120 20,80 Q 20,40 60,40 Q 80,10 120,20 Q 160,0 200,30 Q 240,10 260,50 Q 300,50 300,90 Q 300,120 260,120 Z" />
      </svg>
      <svg        className="absolute top-28 -right-16 w-[480px] h-[200px] filter drop-shadow-sm opacity-60 transition-colors duration-700"
        viewBox="0 0 320 160"
        style={{ color: `rgba(${accentRgb}, 0.10)` }}
        fill="currentColor"
      >
        <path d="M 70,120 Q 30,120 30,85 Q 30,50 70,50 Q 90,15 130,25 Q 170,5 210,35 Q 250,15 270,55 Q 310,55 310,95 Q 310,120 270,120 Z" />
      </svg>
      <svg        className="absolute top-0 left-0 w-full h-[620px] opacity-60 transition-all duration-700"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1440 620"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-50,220 C280,120 480,310 820,180 C1140,60 1320,240 1500,160"
          stroke="url(#skyStream)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <path
          d="M0,380 C320,290 620,440 960,320 C1280,210 1420,360 1520,300"
          stroke="url(#skyStream2)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <defs>
          <linearGradient id="skyStream" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0" />
            <stop offset="30%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="70%" stopColor={accentLight} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="skyStream2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg        className="absolute top-20 right-[18%] w-10 h-10 transform -rotate-12 transition-all duration-700all duration-700"
        style={{ color: accent, opacity: 0.65 }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l18-7-7 18-3-8-8-3z" />
      </svg>    </div>  );
    };