import React from 'react';
import { THEME_CONFIG } from '../constants';
import { ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';

interface AnesthesiaOffRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeName;
}

export const AnesthesiaOffRequiredModal: React.FC<AnesthesiaOffRequiredModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
}) => {
  const { t } = useLanguage();
  // Use a generic theme or the passed anesthesia theme for consistency
  const themeColors = THEME_CONFIG[currentTheme] || THEME_CONFIG.anesthesia; 

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-gray-800 p-6 border-2 border-red-500 rounded-lg shadow-xl w-full max-w-sm text-center transform transition-all scale-100 opacity-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-xl font-semibold text-red-400 mb-4`}>
          {t.anesthesiaOffRequiredTitle}
        </h3>
        <p className="text-gray-300 mb-6 text-sm">
          {t.anesthesiaOffRequiredMessage}
        </p>
        <button
          onClick={onClose}
          className={`px-6 py-2.5 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-${themeColors.accent}`}
        >
          {t.modalConfirm} 
        </button>
      </div>
    </div>
  );
};