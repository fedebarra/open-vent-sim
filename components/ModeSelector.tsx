
import React, { useRef, useEffect } from 'react';
import { VentilationMode, VentModeConfig, OperatingMode, ICUSubMode, ThemeName } from '../types';
import { VENT_MODES_CONFIG, THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path
import { TranslationKeys } from '../src/i18n/locales'; // Corrected path

interface ModeSelectorProps {
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  onSelectMode: (mode: VentilationMode) => void;
  onClose: () => void;
}

interface ModeOptionProps {
  modeKey: VentilationMode;
  config: Omit<VentModeConfig, 'name'> & { nameKey: TranslationKeys, color: string, textColor?: string };
  isSelected: boolean;
  currentTheme: ThemeName;
  onClick: () => void;
}

const ModeOption: React.FC<ModeOptionProps> = ({ modeKey, config, isSelected, currentTheme, onClick }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  
  // Use config.textColor if provided, otherwise default based on theme
  const textColor = config.textColor ? `text-[${config.textColor}]` : themeColors.textOnPrimary;
  const hoverTextColor = config.textColor ? `hover:text-[${config.textColor}]` : `hover:${themeColors.textOnPrimary}`;
  
  // Dynamic background for selected and non-selected states
  const selectedBg = `bg-${themeColors.primary}`;
  const unselectedBg = config.textColor ? `bg-[${config.color}]/40` : `bg-${themeColors.primaryDark}/30`;
  const hoverBg = `hover:bg-${themeColors.primaryLight}/50`;


  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 my-1 rounded-lg text-xs font-semibold transition-all duration-300 ease-in-out
                  ${isSelected ? `${selectedBg} ${themeColors.textOnPrimary} shadow-md` : `${unselectedBg} ${textColor} ${hoverTextColor} ${hoverBg} hover:translate-x-1`}`}
      title={`${t.modalEditTitlePrefix}${t[config.nameKey]}`}
    >
      {t[config.nameKey].toUpperCase()}
    </button>
  );
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, operatingMode, icuSubMode, currentTheme, onSelectMode, onClose }) => {
  const selectorRef = useRef<HTMLDivElement>(null);
  const themeColors = THEME_CONFIG[currentTheme];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        const modeIndicatorButton = document.getElementById('modeIndicator');
        if (modeIndicatorButton && modeIndicatorButton.contains(event.target as Node)) {
            return; 
        }
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  let availableModes: VentilationMode[] = [];

  if (operatingMode === 'anesthesia') {
    availableModes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.PS];
  } else if (operatingMode === 'icu') {
    if (icuSubMode === 'invasive') {
      availableModes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.SIMV, VentilationMode.PS];
    } else if (icuSubMode === 'non-invasive') {
      availableModes = [VentilationMode.CPAP, VentilationMode.PS];
    } else if (icuSubMode === 'high-flow') {
      availableModes = [VentilationMode.HIGH_FLOW];
    }
  }

  if (availableModes.length === 0 || (availableModes.length === 1 && availableModes[0] === VentilationMode.HIGH_FLOW)) {
      // return null; // Logic in VentilatorInterface usually handles this
  }


  return (
    <div
      ref={selectorRef}
      className={`absolute top-[125px] left-5 bg-gray-800 border-2 ${themeColors.border} rounded-lg p-2.5 shadow-2xl z-[200] w-64`}
    >
      {availableModes.map((modeKey) => {
        const config = VENT_MODES_CONFIG[modeKey];
        if (!config) return null;
        return (
          <ModeOption
            key={modeKey}
            modeKey={modeKey}
            config={config}
            isSelected={modeKey === currentMode}
            currentTheme={currentTheme}
            onClick={() => onSelectMode(modeKey)}
          />
        );
      })}
    </div>
  );
};
