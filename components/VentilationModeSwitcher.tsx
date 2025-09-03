
import React from 'react';
import { ThemeName } from '../types';
import { THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';

interface VentilationModeSwitcherProps {
  isMechanicalVentilation: boolean;
  onSelectMode: (isMechanical: boolean) => void;
  currentTheme: ThemeName;
}

const SwitcherButton: React.FC<{
  label: string;
  onClick: () => void;
  isActive: boolean;
  themeColors: typeof THEME_CONFIG[ThemeName];
}> = ({ label, onClick, isActive, themeColors }) => {
  const baseClasses = `w-full py-3 px-2 text-xs sm:text-sm font-semibold rounded-md shadow-md transition-all duration-200 ease-in-out border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700`;
  
  // Active state uses theme's primary button gradient and text color
  const activeStateClasses = `bg-gradient-to-r ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} ${themeColors.textOnPrimary} border-${themeColors.border} ring-${themeColors.accent}`;
  
  // For inactive state, use a more subdued look
  const inactiveBg = 'bg-gray-600'; 
  const inactiveText = 'text-gray-200'; 
  const inactiveBorder = 'border-gray-500'; 
  const inactiveHoverBg = 'hover:bg-gray-500'; 
  const inactiveHoverBorder = 'hover:border-gray-400';
  
  const inactiveStateClasses = `${inactiveBg} ${inactiveText} ${inactiveBorder} ${inactiveHoverBg} ${inactiveHoverBorder} ring-gray-500`;

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeStateClasses : inactiveStateClasses}`}
      aria-pressed={isActive}
    >
      {label.toUpperCase()}
    </button>
  );
};

export const VentilationModeSwitcher: React.FC<VentilationModeSwitcherProps> = ({
  isMechanicalVentilation,
  onSelectMode,
  currentTheme,
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  return (
    <div className="flex space-x-2 w-full my-3">
      <SwitcherButton
        label={t.manualVentilationLabel} // "Bag-Mask Ventilation"
        onClick={() => onSelectMode(false)}
        isActive={!isMechanicalVentilation}
        themeColors={themeColors}
      />
      <SwitcherButton
        label={t.mechanicalVentilationLabel} // "Mechanical Ventilation"
        onClick={() => onSelectMode(true)}
        isActive={isMechanicalVentilation}
        themeColors={themeColors}
      />
    </div>
  );
};