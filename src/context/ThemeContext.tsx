import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  normalizeHex,
  darkenHex,
  lightenHex,
  getRgbString,
  getTintRgba,
} from '../utils/colors';

export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const BEST_PRESET_COLORS: ColorPreset[] = [
  {
    id: 'limewire',
    name: 'Lime Green',
    hex: '#16a34a',
    description: 'Fresh LimeWire emerald green',
  },
  {
    id: 'transfernow',
    name: 'Transfer Orange',
    hex: '#f97316',
    description: 'Energetic TransferNow tangerine',
  },
  {
    id: 'sky',
    name: 'Sky Blue',
    hex: '#0284c7',
    description: 'Clear atmospheric sky blue',
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    hex: '#2563eb',
    description: 'Deep vibrant royal blue',
  },
  {
    id: 'violet',
    name: 'Violet',
    hex: '#7c3aed',
    description: 'Modern clean purple',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    hex: '#0f172a',
    description: 'Minimalist deep midnight slate',
  },
  {
    id: 'coral',
    name: 'Coral',
    hex: '#e11d48',
    description: 'Vibrant punchy rose',
  },
  {
    id: 'amber',
    name: 'Amber',
    hex: '#d97706',
    description: 'Warm golden sun',
  },
];

interface ThemeContextType {
  accent: string;
  accentHover: string;
  accentLight: string;
  accentTint: string;
  accentBorder: string;
  accentRgb: string;
  setAccentColor: (hex: string) => void;
  resetToDefault: () => void;
  isCustomColor: boolean;
  activePresetId: string | null;
}

const STORAGE_KEY = 'shareme-accent-theme-v3';
const DEFAULT_COLOR = '#0f172a';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accent, setAccentState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeHex(saved);
    } catch {}
    return DEFAULT_COLOR;
  });

  const setAccentColor = (hex: string) => {
    const normalized = normalizeHex(hex);
    setAccentState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {}
  };

  const resetToDefault = () => {
    setAccentColor(DEFAULT_COLOR);
  };

  const activePreset = useMemo(() => {
    return BEST_PRESET_COLORS.find(
      (p) => p.hex.toLowerCase() === accent.toLowerCase()
    );
  }, [accent]);

  const themeDerived = useMemo(() => {
    const hover = darkenHex(accent, 0.18);
    const light = lightenHex(accent, 0.25);
    const rgb = getRgbString(accent);
    const tint = getTintRgba(accent, 0.08);
    const border = getTintRgba(accent, 0.16);

    return {
      accent,
      accentHover: hover,
      accentLight: light,
      accentTint: tint,
      accentBorder: border,
      accentRgb: rgb,
      isCustomColor: !activePreset,
      activePresetId: activePreset ? activePreset.id : null,
    };
  }, [accent, activePreset]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-accent', themeDerived.accent);
    root.style.setProperty('--color-accent-hover', themeDerived.accentHover);
    root.style.setProperty('--color-accent-light', themeDerived.accentLight);
    root.style.setProperty('--color-accent-tint', themeDerived.accentTint);
    root.style.setProperty('--color-accent-border', themeDerived.accentBorder);
    root.style.setProperty('--color-accent-rgb', themeDerived.accentRgb);
  }, [themeDerived]);

  return (
    <ThemeContext.Provider      value={{
        ...themeDerived,
        setAccentColor,
        resetToDefault,
    }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};