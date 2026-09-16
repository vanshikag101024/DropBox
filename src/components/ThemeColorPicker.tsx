import React, { useState, useRef, useEffect } from 'react';
import { useTheme, BEST_PRESET_COLORS } from '../context/ThemeContext';

export const ThemeColorPicker: React.FC = () => {
  const { accent, setAccentColor, activePresetId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="theme-picker-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold shadow-2xs border border-slate-200/80 transition-all cursor-pointer"
        title="Change theme color"
      >
        <span
          className="w-3.5 h-3.5 rounded-full shadow-inner ring-2 ring-white/50"
          style={{ backgroundColor: accent }}
        />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 p-3 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Accent Colors
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {BEST_PRESET_COLORS.map((color) => {
              const isSelected = activePresetId === color.id || accent.toLowerCase() === color.hex.toLowerCase();
              return (
                <button
                  key={color.id}
                  onClick={() => {
                    setAccentColor(color.hex);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer hover:bg-slate-100 ${
                    isSelected ? 'ring-2 ring-offset-1 ring-slate-900 bg-slate-50' : ''
                  }`}
                  title={color.description}
                >
                  <span
                    className="w-6 h-6 rounded-full shadow-xs"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-[10px] font-medium text-slate-600 truncate max-w-full">
                    {color.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-medium">Custom</span>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-6 h-6 rounded-full border-0 cursor-pointer overflow-hidden bg-transparent"
              title="Pick a custom color"
            />
          </div>
        </div>
      )}
    </div>
  );
};
