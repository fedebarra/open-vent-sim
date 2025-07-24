
import React from 'react';
import { VentilationMode, OperatingMode, ICUSubMode, ThemeName } from '../types';
import { VENT_MODES_CONFIG, THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';
import { TranslationKeys } from '../src/i18n/locales';

interface InlineModeSelectorProps {
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null; 
  currentTheme: ThemeName;
  onSelectMode: (mode: VentilationMode) => void;
}

interface ModeButtonProps {
  label: string;
  onClick: () => void;
  isSelected: boolean;
  themeColors: typeof THEME_CONFIG[ThemeName];
}

const ModeButton: React.FC<ModeButtonProps> = ({ label, onClick, isSelected, themeColors }) => {
  const baseClasses = `px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ease-in-out shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-800 flex-grow text-center border`;
  
  let dynamicClasses = '';

  if (isSelected) {
    dynamicClasses = `bg-${themeColors.selectedModeButtonBg} ${themeColors.selectedModeButtonText} border-${themeColors.accent} hover:opacity-90`;
  } else {
    // Use a subdued background for unselected buttons, could be a darker gray or a desaturated theme color
    // For simplicity, using gray-700 as a base for unselected, with theme-based hover
    dynamicClasses = `bg-gray-700 text-gray-300 border-gray-600 hover:bg-${themeColors.primary}/30 hover:text-${themeColors.textOnPrimary} hover:border-${themeColors.accent}`;
  }


  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${dynamicClasses}`}
      title={label}
    >
      {label.toUpperCase()}
    </button>
  );
};


export const InlineModeSelector: React.FC<InlineModeSelectorProps> = ({
  currentMode,
  operatingMode,
  icuSubMode,
  currentTheme,
  onSelectMode,
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  let availableModes: VentilationMode[] = [];

  if (operatingMode === 'icu') {
    if (icuSubMode === 'invasive') {
      availableModes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.SIMV, VentilationMode.PS];
    } else if (icuSubMode === 'non-invasive') {
      availableModes = [VentilationMode.CPAP, VentilationMode.PS]; 
    }
  } else if (operatingMode === 'anesthesia') {
    availableModes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.PS];
  }


  if (availableModes.length === 0) {
    return null;
  }
  if (operatingMode === 'icu' && icuSubMode === 'high-flow') return null;


  return (
    <div className={`p-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50`}>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {availableModes.map((modeKey) => {
          const config = VENT_MODES_CONFIG[modeKey];
          if (!config) return null;

          // For NIV PS, the full label might be "NIV (PS)", but acronym remains PSV.
          // The InlineModeSelector now always uses the acronym.
          const acronymLabel = t[config.acronymKey]; 

          return (
            <ModeButton
              key={modeKey}
              label={acronymLabel}
              onClick={() => onSelectMode(modeKey)}
              isSelected={modeKey === currentMode}
              themeColors={themeColors}
            />
          );
        })}
      </div>
    </div>
  );
};