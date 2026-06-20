import React, { useState, useEffect } from 'react';
import { PARAMETER_DEFINITIONS, THEME_CONFIG, HIGH_FLOW_TEMP_VALUES_ADULT, HIGH_FLOW_TEMP_VALUES_JUNIOR } from '../constants';
import { ParameterKey, ThemeName, OperatingMode, ICUSubMode, HighFlowInterfaceType } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';

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
  onConfirm: (newValue: string, shouldClose?: boolean) => void;
  onClose: () => void;
}

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
        setCurrentValueInModal(initialValue);
      } else {
        setCurrentValueInModal(initialValue);
      }
    }
  }, [initialValue, isOpen, paramKey]);

  if (!isOpen || !paramKey) return null;

  const paramDef = PARAMETER_DEFINITIONS[paramKey];
  const isRatioInput = paramKey === 'ratio';

  const handleConfirmValue = (valueToSet?: string) => {
    if (valueToSet) {
      onConfirm(valueToSet, true);
    } else {
      if (isRatioInput) {
        onConfirm(`1:${editableEPart.toFixed(1)}`, true);
      } else {
        onConfirm(currentValueInModal, true);
      }
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmValue();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  const adjustEPart = (increment: boolean) => {
    setEditableEPart(prevE => {
      let newE = prevE + (increment ? 0.1 : -0.1);
      newE = Math.max(0.5, Math.min(4.0, newE)); 
      const finalE = parseFloat(newE.toFixed(1));
      // Real-time optimistic update of state without closing the modal
      onConfirm(`1:${finalE}`, false);
      return finalE;
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

    if (paramKey === 'temperature' && operatingMode === 'icu' && icuSubMode === 'high-flow') {
        const allowedTemps = highFlowInterfaceType === 'junior' ? HIGH_FLOW_TEMP_VALUES_JUNIOR : HIGH_FLOW_TEMP_VALUES_ADULT;
        numValue = allowedTemps.reduce((prev, curr) => 
            (Math.abs(curr - numValue) < Math.abs(prev - numValue) ? curr : prev)
        );
    }
    
    const precision = getStepPrecision(currentStep);
    const updatedStrVal = numValue.toFixed(precision);
    setCurrentValueInModal(updatedStrVal);
    
    // Real-time optimistic update of state without closing the modal
    onConfirm(updatedStrVal, false);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 backdrop-blur-[1px] transition-opacity duration-200"
      onClick={() => handleConfirmValue()}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: '#0e1522',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '24px 28px',
          width: '290px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Param title in light grey centered */}
        <span style={{ fontSize: '14.5px', color: '#8a97ad', fontWeight: 500, letterSpacing: '0.5px' }}>
          {title}
        </span>

        {isRatioInput ? (
          /* Ratio controls row */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '14px', margin: '6px 0' }}>
            <button
              onClick={() => adjustEPart(false)}
              disabled={editableEPart <= 0.5}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#1d2636',
                border: 'none',
                color: '#ffffff',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: editableEPart <= 0.5 ? 0.35 : 1,
                transition: 'opacity 0.2s, background 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <span style={{ fontSize: '38px', fontWeight: '700', color: '#ffffff', fontFamily: 'monospace', lineHeight: 1 }}>
                1:{editableEPart.toFixed(1)}
              </span>
              <span style={{ fontSize: '11px', color: '#6f7c90', marginTop: '6px', fontWeight: 600, letterSpacing: '0.8px' }}>I:E</span>
            </div>
            <button
              onClick={() => adjustEPart(true)}
              disabled={editableEPart >= 4.0}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#2580e8',
                border: 'none',
                color: '#ffffff',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: editableEPart >= 4.0 ? 0.35 : 1,
                transition: 'opacity 0.2s, background 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        ) : (
          /* Numeric controls row */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '14px', margin: '6px 0' }}>
            <button
              onClick={() => handleNumericStep(false)}
              disabled={paramDef && paramDef.min !== undefined && parseFloat(currentValueInModal) <= paramDef.min}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#1d2636',
                border: 'none',
                color: '#ffffff',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: (paramDef && paramDef.min !== undefined && parseFloat(currentValueInModal) <= paramDef.min) ? 0.35 : 1,
                transition: 'opacity 0.2s, background 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
              className="hover:bg-[#252f44]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <span style={{ fontSize: '38px', fontWeight: '700', color: '#ffffff', fontFamily: 'monospace', lineHeight: 1 }}>
                {paramKey === 'peep' && Number(currentValueInModal) > 0 ? `+${currentValueInModal}` : currentValueInModal}
              </span>
              {unit && <span style={{ fontSize: '11px', color: '#6f7c90', marginTop: '6px', fontWeight: 600, letterSpacing: '0.8px' }}>{unit}</span>}
            </div>
            <button
              onClick={() => handleNumericStep(true)}
              disabled={paramDef && paramDef.max !== undefined && parseFloat(currentValueInModal) >= paramDef.max}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#2580e8',
                border: 'none',
                color: '#ffffff',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: (paramDef && paramDef.max !== undefined && parseFloat(currentValueInModal) >= paramDef.max) ? 0.35 : 1,
                transition: 'opacity 0.2s, background 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
              className="hover:bg-[#2689fd]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        )}

        {/* Small check button to close and confirm */}
        <button
          onClick={() => handleConfirmValue()}
          style={{
            alignSelf: 'stretch',
            padding: '12px 0',
            background: 'linear-gradient(180deg,#2580e8,#1a69c4)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            marginTop: '4px'
          }}
        >
          {t.modalConfirm || 'OK'}
        </button>
      </div>
    </div>
  );
};
