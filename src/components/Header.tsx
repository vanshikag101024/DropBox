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
        {activeSharesCount > 0 && (
          <button            id="nav-tab-active-shares"
            onClick={() => setActiveTab(activeTab === 'active-shares' ? 'send' : 'active-shares')}
            className={`text-xs font-sans font-semibold px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'active-shares'
                ? 'bg-slate-900 text-white'
                : 'bg-white/80 hover:bg-white text-slate-700 shadow-2xs border border-slate-200/80'
            }`}
          >
            <span              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span>Transfers</span>           
                  <span className="font-sans text-[10.5px] opacity-75">
              ({activeSharesCount})
            </span>       
   </button>
        )}
      </div>
      <div className="flex items-center">
        <ThemeColorPicker />
      </div>    
   </div>
  );
};