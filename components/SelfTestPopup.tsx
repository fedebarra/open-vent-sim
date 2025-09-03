import React from 'react';
import { SelfTestItem, ThemeName, TranslationKeys } // Added TranslationKeys
from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';
import { THEME_CONFIG } from '../constants';

interface SelfTestPopupProps {
  isOpen: boolean;
  progressItems: SelfTestItem[];
  currentTheme: ThemeName;
  overrideTitleKey?: TranslationKeys; // New optional prop
}

export const SelfTestPopup: React.FC<SelfTestPopupProps> = ({ isOpen, progressItems, currentTheme, overrideTitleKey }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className={`bg-gray-800 p-6 border-2 ${themeColors.border} rounded-lg shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 opacity-100`}
      >
        <h3 className={`text-2xl font-bold text-center text-${themeColors.accent} mb-6 pb-2 border-b-2 ${themeColors.border}`}>
          {overrideTitleKey ? t[overrideTitleKey] : t.selfTestInProgressTitle}
        </h3>
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-2">
          {progressItems.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-2.5 bg-gray-700/50 rounded-md">
              <span className="text-sm text-gray-200">{t[item.nameKey]}</span>
              <span 
                className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${item.status === 'pending' ? 'bg-yellow-500/30 text-yellow-300 animate-custom-pulse' : ''}
                  ${item.status === 'succeeded' ? 'bg-green-500/30 text-green-300' : ''}
                  ${item.status === 'failed' ? 'bg-red-500/30 text-red-300' : ''}
                  ${item.status === 'running' ? `bg-${themeColors.primaryLight}/30 text-${themeColors.accent} animate-custom-pulse` : ''}
                `}
              >
                {t[`selfTest_status_${item.status}`]}
              </span>
            </div>
          ))}
        </div>
         <div className="mt-6 text-center text-xs text-gray-400">
            Please wait while the system performs critical checks...
        </div>
      </div>
    </div>
  );
};
