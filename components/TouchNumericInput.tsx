import React, { useState, useEffect, useCallback } from 'react';
import { THEME_CONFIG } from '../constants';
import { ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';

interface TouchNumericInputProps {
  initialValue: string;
  title: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  showKeypad?: boolean; // New prop
  themeColors: typeof THEME_CONFIG[ThemeName];
  onConfirm: (value: string) => void;
  onClose: () => void;
}

const KeypadButton: React.FC<{
  value: string;
  onClick: (value: string) => void;
  className?: string;
  themeColors: typeof THEME_CONFIG[ThemeName];
  isLarge?: boolean;
}> = ({ value, onClick, className = '', themeColors, isLarge = false }) => (
  <button
    onClick={() => onClick(value)}
    className={`rounded-lg transition-colors duration-200 ease-in-out
                border border-${themeColors.primaryDark}/50
                ${isLarge ? 'col-span-2 text-lg h-14' : 'text-xl h-14'}
                bg-${themeColors.primaryDark}/30 text-white hover:bg-${themeColors.primaryDark}/60 active:bg-${themeColors.primaryLight}/50
                ${className}`}
    title={value === '⌫' ? 'Backspace' : value === 'C' ? 'Clear' : `Enter ${value}`}
  >
    {value}
  </button>
);

const StepperButton: React.FC<{
    icon: string;
    onClick: () => void;
    themeColors: typeof THEME_CONFIG[ThemeName];
    disabled?: boolean;
}> = ({ icon, onClick, themeColors, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-12 h-12 rounded-lg text-2xl
                    bg-${themeColors.primaryDark}/50 text-white
                    hover:bg-${themeColors.primaryDark}/80 active:bg-${themeColors.primaryLight}/60
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200 ease-in-out border border-${themeColors.primaryDark}/70`}
    >
        {icon}
    </button>
);


export const TouchNumericInput: React.FC<TouchNumericInputProps> = ({
  initialValue, title, unit, min, max, step = 1, allowDecimal = true, showKeypad = true, themeColors, onConfirm, onClose,
}) => {
  const [currentValue, setCurrentValue] = useState(initialValue);
  const { t } = useLanguage();

  useEffect(() => {
    setCurrentValue(initialValue);
  }, [initialValue]);

  const handleKeyPress = useCallback((key: string) => {
    setCurrentValue(prev => {
      if (key === '⌫') {
        return prev.slice(0, -1);
      }
      if (key === 'C') {
        return min !== undefined ? String(min) : '0';
      }
      if (key === '.' && (!allowDecimal || prev.includes('.'))) {
        return prev;
      }
      let newValueStr = prev + key;
      
      if (newValueStr.length > 10) return prev; 

      return newValueStr;
    });
  }, [allowDecimal, min]);

  const validateAndFormatValue = (valStr: string): string => {
    if (valStr === '' || valStr === '-') return valStr; 
    let num = parseFloat(valStr);
    if (isNaN(num)) return min !== undefined ? String(min) : '0'; 

    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    
    if (!allowDecimal) num = Math.round(num);
    else { // Handle precision for decimals based on step
        const stepStr = String(step);
        if (stepStr.includes('.')) {
            const precision = stepStr.split('.')[1].length;
            num = parseFloat(num.toFixed(precision));
        }
    }


    return String(num);
  }

  const handleConfirmInternal = () => {
    onConfirm(validateAndFormatValue(currentValue));
  };
  
  const handleStep = (direction: 'increment' | 'decrement') => {
      setCurrentValue(prev => {
          let num = parseFloat(prev);
          if (isNaN(num)) num = min !== undefined ? min : 0; // Default to min if invalid, else 0

          if (direction === 'increment') {
              num += step;
          } else {
              num -= step;
          }
          return validateAndFormatValue(String(num));
      });
  };

  const keypadLayout = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    allowDecimal ? ['C', '0', '.'] : ['C', '0', ''],
    ['⌫']
  ];
  if (!allowDecimal && keypadLayout[3]) keypadLayout[3][2] = '';


  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-gray-800 p-5 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-xs transform transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-xl font-semibold text-${themeColors.accent} mb-3 text-center`}>{title}</h3>
        
        <div className="flex items-center justify-between mb-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
            <StepperButton icon="-" onClick={() => handleStep('decrement')} themeColors={themeColors} disabled={min !== undefined && parseFloat(currentValue) <= min} />
            <div className="flex-grow text-center">
                <span className={`text-3xl font-bold text-white tabular-nums`}>{currentValue || (min !== undefined ? String(min) : "0")}</span>
                {unit && <span className="ml-1 text-lg text-gray-400">{unit}</span>}
            </div>
            <StepperButton icon="+" onClick={() => handleStep('increment')} themeColors={themeColors} disabled={max !== undefined && parseFloat(currentValue) >= max} />
        </div>

        {showKeypad && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {keypadLayout.map((row, rowIndex) =>
              row.map((key) =>
                key ? (
                  <KeypadButton
                    key={`${rowIndex}-${key}`}
                    value={key}
                    onClick={handleKeyPress}
                    themeColors={themeColors}
                    isLarge={key === '⌫'}
                    className={key === '⌫' ? `bg-red-700/50 hover:bg-red-600/50 col-span-3` : (key === '' ? 'opacity-0 pointer-events-none': '')}
                  />
                ) : <div key={`${rowIndex}-empty`} /> 
              )
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors w-1/2
                        bg-gray-600 text-white hover:bg-gray-500`}
          >
            {t.modalCancel}
          </button>
          <button
            onClick={handleConfirmInternal}
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors w-1/2
                        bg-green-600 text-white hover:bg-green-500`}
          >
            {t.modalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};