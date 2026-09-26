import React from 'react';
import { ActiveTab } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColorPicker } from './ThemeColorPicker';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeSharesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeSharesCount,
}) => {
  const { accent } = useTheme();

  return (
    <div id="top-nav"
      className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-5 sm:pt-7 flex items-center justify-between relative z-30 pointer-events-auto"
    >

      <div className="flex items-center gap-4">
        <button          id="brand-logo-btn"
          onClick={() => setActiveTab('send')}
          className="font-hand text-[44px] sm:text-[52px] font-bold tracking-tight text-slate-900 leading-none hover:opacity-85 transition-opacity cursor-pointer select-none"
        >
          DropBox
        </button>

      </div>
      <div className="flex items-center">
        <ThemeColorPicker />
      </div>    
   </div>
  );
};