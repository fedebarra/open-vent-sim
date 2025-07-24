
import React, { useState, useEffect, useCallback } from 'react';
import { PARAMETER_DEFINITIONS, THEME_CONFIG, HIGH_FLOW_ADULT_FGF_MIN, HIGH_FLOW_ADULT_FGF_MAX, HIGH_FLOW_PEDIATRIC_FGF_MIN, HIGH_FLOW_PEDIATRIC_FGF_MAX, HIGH_FLOW_FGF_STEP_LOW, HIGH_FLOW_FGF_STEP_HIGH, HIGH_FLOW_FGF_ADULT_TRANSITION_POINT, HIGH_FLOW_TEMP_MIN, HIGH_FLOW_TEMP_MAX_ADULT, HIGH_FLOW_TEMP_MAX_JUNIOR, HIGH_FLOW_TEMP_STEP, HIGH_FLOW_TEMP_VALUES_ADULT, HIGH_FLOW_TEMP_VALUES_JUNIOR } from '../constants';
import { ParameterKey, ThemeName, OperatingMode, ICUSubMode, HighFlowInterfaceType } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path

interface ParameterModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  unit: string;
  paramKey: ParameterKey | null;
  currentTheme: ThemeName;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  highFlowInterfaceType: HighFlowInterfaceType | null;
  onConfirm: (newValue: string) => void;
  onClose: () => void;
}

const StepperButton: React.FC<{
    icon: string;
    onClick: () => void;
    themeColors: typeof THEME_CONFIG[ThemeName];
    disabled?: boolean;
}> = ({ icon, onClick, themeColors, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-16 h-16 rounded-lg text-3xl
                    bg-${themeColors.primaryDark}/50 text-white
                    hover:bg-${themeColors.primaryDark}/80 active:bg-${themeColors.primaryLight}/60
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors duration-200 ease-in-out border border-${themeColors.primaryDark}/70
                    flex items-center justify-center`}
    >
        {icon}
    </button>
);


export const ParameterModal: React.FC<ParameterModalProps> = ({
    isOpen, title, initialValue, unit, paramKey, currentTheme,
    operatingMode, icuSubMode, highFlowInterfaceType,
    onConfirm, onClose
}) => {
  const [currentValueInModal, setCurrentValueInModal] = useState(initialValue);
  const [editableEPart, setEditableEPart] = useState<number>(2.0); // For ratio input
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  useEffect(() => {
    if (isOpen) {
      if (paramKey === 'ratio') {
        const parts = initialValue.split(':');
        const ePartNum = parseFloat(parts[1]);
        setEditableEPart(isNaN(ePartNum) ? 2.0 : parseFloat(ePartNum.toFixed(1)));
        setCurrentValueInModal(initialValue); // Keep original string for ratio too
      } else {
        setCurrentValueInModal(initialValue);
      }
    }
  }, [initialValue, isOpen, paramKey]);

  if (!isOpen || !paramKey) return null;

  const paramDef = PARAMETER_DEFINITIONS[paramKey];
  const isRatioInput = paramKey === 'ratio';

  const handleConfirmValue = () => {
    if (isRatioInput) {
        onConfirm(`1:${editableEPart.toFixed(1)}`);
    } else {
        onConfirm(currentValueInModal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmValue();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  const adjustEPart = (increment: boolean) => { // For I:E Ratio
    setEditableEPart(prevE => {
      let newE = prevE + (increment ? 0.1 : -0.1);
      newE = Math.max(0.5, Math.min(4.0, newE)); 
      return parseFloat(newE.toFixed(1));
    });
  };

  const getStepPrecision = (stepValue: number): number => {
    const stepStr = String(stepValue);
    if (stepStr.includes('.')) {
        return stepStr.split('.')[1].length;
    }
    return 0;
  };
  
  const handleNumericStep = (increment: boolean) => {
    if (!paramDef) return;

    let currentStep = paramDef.step || 1;
    if (paramKey === 'fgf' && paramDef.dynamicStep && operatingMode === 'icu' && icuSubMode === 'high-flow') {
        currentStep = paramDef.dynamicStep(parseFloat(currentValueInModal), highFlowInterfaceType);
    }
    
    let numValue = parseFloat(currentValueInModal);
    if (isNaN(numValue)) numValue = paramDef.min ?? 0;

    numValue = increment ? numValue + currentStep : numValue - currentStep;

    if (paramDef.min !== undefined) numValue = Math.max(paramDef.min, numValue);
    if (paramDef.max !== undefined) numValue = Math.min(paramDef.max, numValue);

    // Specific handling for HF temperature to snap to allowed values
    if (paramKey === 'temperature' && operatingMode === 'icu' && icuSubMode === 'high-flow') {
        const allowedTemps = highFlowInterfaceType === 'junior' ? HIGH_FLOW_TEMP_VALUES_JUNIOR : HIGH_FLOW_TEMP_VALUES_ADULT;
        numValue = allowedTemps.reduce((prev, curr) => 
            (Math.abs(curr - numValue) < Math.abs(prev - numValue) ? curr : prev)
        );
    }
    
    const precision = getStepPrecision(currentStep);
    setCurrentValueInModal(numValue.toFixed(precision));
  };


  if (isRatioInput) {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 transition-opacity duration-300"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ratioModalTitle"
      >
        <div
          className={`bg-gray-800 p-6 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-sm text-center`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <h3 id="ratioModalTitle" className={`text-xl font-semibold text-${themeColors.accent} mb-5`}>{t.modalEditTitlePrefix}{title}</h3>

          <div className="flex items-center justify-center space-x-3 my-6">
            <StepperButton icon="-" onClick={() => adjustEPart(false)} themeColors={themeColors} disabled={editableEPart <= 0.5} />
            <div className={`text-4xl font-bold text-white tabular-nums px-4 py-2 bg-gray-900 rounded-md border border-${themeColors.primaryDark}/50 min-w-[120px]`}>
              1 : {editableEPart.toFixed(1)}
            </div>
            <StepperButton icon="+" onClick={() => adjustEPart(true)} themeColors={themeColors} disabled={editableEPart >= 4.0} />
          </div>

          <div className="flex gap-4 justify-center mt-8">
            <button
              onClick={handleConfirmValue}
              className="px-5 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-500 transition-colors w-1/2 text-lg"
            >
              {t.modalConfirm}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-500 transition-colors w-1/2 text-lg"
            >
              {t.modalCancel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Numeric Stepper UI for non-ratio parameters
  return (
    <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 transition-opacity duration-300"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="numericModalTitle"
    >
      <div
        className={`bg-gray-800 p-6 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-xs text-center`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h3 id="numericModalTitle" className={`text-xl font-semibold text-${themeColors.accent} mb-5`}>{t.modalEditTitlePrefix}{title}</h3>
        
        <div className="flex items-center justify-center space-x-3 my-6">
            <StepperButton 
                icon="-" 
                onClick={() => handleNumericStep(false)} 
                themeColors={themeColors} 
                disabled={paramDef && paramDef.min !== undefined && parseFloat(currentValueInModal) <= paramDef.min}
            />
            <div className={`text-4xl font-bold text-white tabular-nums px-4 py-2 bg-gray-900 rounded-md border border-${themeColors.primaryDark}/50 min-w-[120px] flex-grow text-center`}>
              {currentValueInModal}
              {unit && <span className="ml-1 text-2xl text-gray-400 align-middle">{unit}</span>}
            </div>
            <StepperButton 
                icon="+" 
                onClick={() => handleNumericStep(true)} 
                themeColors={themeColors} 
                disabled={paramDef && paramDef.max !== undefined && parseFloat(currentValueInModal) >= paramDef.max}
            />
        </div>

        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={handleConfirmValue}
            className="px-5 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-500 transition-colors w-1/2 text-lg"
          >
            {t.modalConfirm}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-500 transition-colors w-1/2 text-lg"
          >
            {t.modalCancel}
          </button>
        </div>
      </div>
    </div>
  );
};
