
import React, { useEffect, useRef } from 'react';
import { VentilationMode, OperatingMode, ICUSubMode, ThemeName } from '../types';
import { VENT_MODES_CONFIG, THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path

interface ModeIndicatorButtonProps {
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  onClick: () => void;
  isChanging: boolean;
}

export const ModeIndicatorButton: React.FC<ModeIndicatorButtonProps> = ({ currentMode, operatingMode, icuSubMode, currentTheme, onClick, isChanging }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const modeConfig = VENT_MODES_CONFIG[currentMode];
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isChanging && buttonRef.current) {
      buttonRef.current.classList.add('animate-mode-change');
      const timer = setTimeout(() => {
        buttonRef.current?.classList.remove('animate-mode-change');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isChanging]);
  
  // Use new theme colors for selected mode button
  const buttonBackgroundColorClass = `bg-${themeColors.selectedModeButtonBg}`; 
  const buttonTextColorClass = themeColors.selectedModeButtonText;
  const buttonShadowColor = themeColors.accent; // Shadow can still be theme's accent

  if (operatingMode === 'icu' && icuSubMode === 'high-flow') {
    return null; 
  }

  const displayText = t[modeConfig.acronymKey];


  return (
    <button
      ref={buttonRef}
      id="modeIndicator"
      onClick={onClick}
      className={`absolute top-[70px] left-5 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all duration-300 ease-in-out z-[100] hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 
                 ${buttonBackgroundColorClass} ${buttonTextColorClass}`}
      style={{
        // For Tailwind JIT: bg-yellow-400 text-black bg-sky-300
        // Ensure these classes are generated if using dynamic parts like themeColors.selectedModeButtonBg
        boxShadow: `0 3px 12px var(--shadow-color, ${themeColors.accent === 'teal-500' ? 'rgba(20, 184, 166, 0.5)' : themeColors.accent === 'sky-500' ? 'rgba(3, 169, 244, 0.5)' : themeColors.accent === 'amber-500' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(128, 128, 128, 0.5)'})`,
        // CSS variable for shadow color for better control if needed, fallback to JS evaluated color
        '--shadow-color': themeColors.accent === 'teal-500' ? 'rgba(20, 184, 166, 0.5)' : themeColors.accent === 'sky-500' ? 'rgba(3, 169, 244, 0.5)' : themeColors.accent === 'amber-500' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(128, 128, 128, 0.5)'
      } as React.CSSProperties}
      title={t.changeVentModeTitle}
    >
      {displayText}
    </button>
  );
};
