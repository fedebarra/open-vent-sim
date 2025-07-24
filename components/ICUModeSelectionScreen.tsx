
import React from 'react';
import { ICUSubMode, ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path
import { THEME_CONFIG } from '../constants'; // Import ThemeName
import { Footer } from './Footer'; // Import the common Footer

interface ICUModeSelectionScreenProps {
  onSelect: (subMode: ICUSubMode) => void;
  onBack: () => void;
  currentTheme: ThemeName; // ICU theme will be passed
}

const TherapyButton: React.FC<{label: string, onClick: () => void, themeColors: typeof THEME_CONFIG[ThemeName]}> = ({label, onClick, themeColors}) => (
  <button
    onClick={onClick}
    className={`w-full md:w-96 h-20 md:h-24 rounded-lg bg-gradient-to-br ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} border-2 ${themeColors.border} ${themeColors.textOnPrimary} text-xl md:text-2xl
                font-semibold
               flex items-center justify-center shadow-lg shadow-black/50
               transition-all duration-300 ease-in-out
               hover:scale-105 hover:shadow-xl hover:shadow-${themeColors.accent}/50 hover:from-${themeColors.primaryLight} hover:to-${themeColors.primary}
               active:scale-95 my-3`}
    title={label}
  >
    {label}
  </button>
);

export const ICUModeSelectionScreen: React.FC<ICUModeSelectionScreenProps> = ({ onSelect, onBack, currentTheme }) => {
  const { t } = useLanguage();
  const icuThemeColors = THEME_CONFIG.icu; // Explicitly use 'icu' theme for Invasive button
  const nonInvasiveThemeColors = THEME_CONFIG.nonInvasive; 

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col justify-between items-center z-[1500] p-4">
      <div className="flex-grow flex flex-col justify-center items-center text-center w-full">
        <div className="mb-8 md:mb-10">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-3" style={{textShadow: '2px 2px 8px rgba(255, 255, 255, 0.3)'}}>
              {t.intensiveCareModeName}
            </h1>
            <p className="text-xl md:text-3xl text-gray-300">
              {t.chooseModalitySubtitle}
            </p>
        </div>
        <div className="flex flex-col items-center w-full max-w-md">
            <TherapyButton
            label={t.invasiveVentilationButton} // Uses "Invasive" from translations
            onClick={() => onSelect('invasive')}
            themeColors={icuThemeColors}
            />
            <TherapyButton
            label={t.nonInvasiveVentilationButton} // Uses "Non-Invasive" from translations
            onClick={() => onSelect('non-invasive')}
            themeColors={nonInvasiveThemeColors}
            />
        </div>
        <button
            onClick={onBack} 
            className="mt-12 px-6 py-3 rounded-md bg-gray-600 text-gray-200 font-semibold hover:bg-gray-500 transition-colors"
        >
            {t.backButton}
        </button>
      </div>
      <Footer />
    </div>
  );
};
