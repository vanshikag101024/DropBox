import React, { useState, useRef, useEffect } from 'react';
import { useTheme, BEST_PRESET_COLORS } from '../context/ThemeContext';

export const ThemeColorPicker: React.FC = () => {
  const { accent, setAccentColor, accentTint } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const quickColors = [
    { id: 'obsidian', hex: '#0f172a', name: 'Obsidian' },
    { id: 'emerald', hex: '#16a34a', name: 'Emerald' },
    { id: 'blue', hex: '#2563eb', name: 'Blue' },
    { id: 'amber', hex: '#f59e0b', name: 'Amber' },
    { id: 'purple', hex: '#9333ea', name: 'Purple' },
    { id: 'rose', hex: '#e11d48', name: 'Rose' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="flex items-center gap-1.5 relative" ref={popoverRef}>

      <div className="flex items-center gap-1.5">
        {quickColors.map((color) => {
          const isSelected = accent.toLowerCase() === color.hex.toLowerCase();
        return (
            <button              key={color.id}
              onClick={() => setAccentColor(color.hex)}
              className={`w-5 h-5 rounded-full transition-transform hover:scale-115 active:scale-95 cursor-pointer flex items-center justify-center relative ${
                isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-105 shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
        );
        })}
      </div>
      <button        id="btn-minimal-color-picker"
        onClick={() => setIsOpen(!isOpen)}
        className="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-115 active:scale-95 relative ring-1 ring-slate-300/80 shadow-2xs ml-0.5 opacity-80 hover:opacity-100 flex items-center justify-center"
        title="More colors"
        style={{
          background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
        }}
      >
        <div className="w-2 h-2 rounded-full bg-white/90 shadow-2xs" />
      </button>
      {isOpen && (
        <div          id="theme-picker-popover"
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-black/10 p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
              Color Theme
            </span>           
             <span              
                  className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-md uppercase"
            style={{ backgroundColor: accentTint, color: accent }}
            >
              {accent}
            </span>          </div>
          <div className="grid grid-cols-4 gap-2 justify-items-center">
            {BEST_PRESET_COLORS.map((preset) => {
              const isSelected = accent.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button                  key={preset.id}
                  onClick={() => {
                    setAccentColor(preset.hex);
                    setIsOpen(false);
                  }}
                  className={`w-7 h-7 rounded-full transition-all focus:outline-none cursor-pointer flex items-center justify-center relative ${
                    isSelected ? 'ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-white text-[14px]">
                      check
                    </span>                  )}
                </button>
              );
            })}
          </div>
          <div className="h-px bg-slate-100 w-full" />

          <button            type="button"
            onClick={() => colorInputRef.current?.click()}
            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left w-full"
          >
            <span className="text-xs font-medium text-slate-700">Custom hex</span>            <span className="material-symbols-outlined text-[16px] text-slate-400">
              colorize
            </span>            <input              ref={colorInputRef}
            type="color"
              value={accent}
              onChange={(e) => setAccentColor(e.target.value)}
              className="sr-only"
            />
          </button>        </div>      )}
    </div>
  );
};