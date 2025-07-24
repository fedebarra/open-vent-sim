
import React from 'react';
import { THEME_CONFIG } from '../constants';
import { ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; 

interface GasToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  currentTheme: ThemeName; // Expected to be 'anesthesia' if visible
  disabled?: boolean; // New prop
}

export const GasToggleButton: React.FC<GasToggleButtonProps> = ({ isActive, onClick, currentTheme, disabled = false }) => {
  const { t } = useLanguage();
  const activeThemeColors = THEME_CONFIG.anesthesia;

  const baseClasses = "w-full px-4 py-3 rounded-lg text-sm font-bold text-white shadow-md transition-all duration-300 ease-in-out flex items-center justify-center gap-2 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";
  
  const activeClasses = `bg-gradient-to-r ${activeThemeColors.buttonGradientFrom} ${activeThemeColors.buttonGradientTo} shadow-${activeThemeColors.accent}/30 ring-${activeThemeColors.accent}`;
  const inactiveClasses = "bg-gradient-to-r from-gray-600 to-gray-500 shadow-black/30 ring-gray-500";
  const disabledClasses = "opacity-50 cursor-not-allowed !bg-gray-500 !from-gray-500 !to-gray-400";


  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${disabled ? disabledClasses : ''}`}
      title={isActive ? t.stopGas : t.startGas}
      disabled={disabled}
    >
      <span className={`w-3 h-3 rounded-full flex items-center justify-center text-xs ${isActive ? 'bg-white/40' : 'bg-white/30'}`}>
        {isActive ? '●' : '○'}
      </span>
      <span>{isActive ? t.stopGas.toUpperCase() : t.startGas.toUpperCase()}</span>
    </button>
  );
};
