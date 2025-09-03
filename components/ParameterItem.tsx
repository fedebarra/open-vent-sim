
import React from 'react';
import { ParameterKey, AlarmSettings, OperatingMode, ICUSubMode, AlarmParameterKey, ThemeName } from '../types';
import { PARAMETER_DEFINITIONS, THEME_CONFIG, ALARMABLE_PARAMETERS_CONFIG } from '../constants'; 
import { useLanguage } from '../src/contexts/LanguageContext'; 

interface ParameterItemProps {
  paramKey: ParameterKey;
  currentValue: string | number;
  currentTheme: ThemeName; 
  onClick?: (paramKey: ParameterKey, label: string, value: string | number, unit: string) => void;
  overrideLabel?: string; 
  overrideValue?: string; 
  valueColorClass?: string; 
  valueColorHex?: string; // New prop for hex color
  alarmSettings?: AlarmSettings; 
  activeAlarms?: Partial<Record<AlarmParameterKey, boolean>>; 
  operatingMode?: OperatingMode | null;
  icuSubMode?: ICUSubMode | null;
  alarmAssociationKey?: AlarmParameterKey; 
}

export const ParameterItem: React.FC<ParameterItemProps> = ({ 
  paramKey, 
  currentValue, 
  currentTheme, 
  onClick, 
  overrideLabel, 
  overrideValue, 
  valueColorClass: initialValueColorClass, 
  valueColorHex, // Destructure new prop
  alarmSettings,
  activeAlarms, 
  operatingMode,
  icuSubMode,
  alarmAssociationKey 
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const definition = PARAMETER_DEFINITIONS[paramKey];
  
  if (!definition) return null;

  const { labelKey, unitKey, isLarge, isEditable, valueFormatter } = definition;
  
  const displayLabel = overrideLabel || t[labelKey];
  const displayUnit = t[unitKey];
  
  const displayValue = overrideValue !== undefined && currentValue !== t.valueNotAvailable 
    ? (valueFormatter ? valueFormatter(overrideValue) : overrideValue)
    : (valueFormatter ? valueFormatter(currentValue) : currentValue);

  const handleClick = () => {
    if (onClick && isEditable && currentValue !== t.valueNotAvailable) { 
      onClick(paramKey, displayLabel, currentValue, displayUnit);
    }
  };
  
  const baseClasses = "flex justify-between items-center mb-2.5 p-2 rounded-lg border-l-4";
  const clickableClasses = isEditable && currentValue !== t.valueNotAvailable ? `cursor-pointer transition-all duration-300 hover:bg-${themeColors.primary}/30 hover:translate-x-0.5` : "cursor-default";

  const effectiveAlarmKey = alarmAssociationKey || (paramKey as AlarmParameterKey);
  const isAlarmableParam = Object.keys(ALARMABLE_PARAMETERS_CONFIG).includes(effectiveAlarmKey as string);
  let isAlarmSetForThisParam = false;

  if (isAlarmableParam && alarmSettings && alarmSettings[effectiveAlarmKey]) {
    const alarmConfig = ALARMABLE_PARAMETERS_CONFIG[effectiveAlarmKey];
    if (alarmConfig) {
        const displayConditionMet = alarmConfig.displayCondition ? alarmConfig.displayCondition(operatingMode ?? undefined, icuSubMode ?? undefined) : true;
        isAlarmSetForThisParam = alarmSettings[effectiveAlarmKey].isOn && displayConditionMet;

        if (effectiveAlarmKey === 'fio2' && operatingMode === 'icu' && icuSubMode === 'high-flow') {
            isAlarmSetForThisParam = alarmSettings.fio2.isOn && displayConditionMet;
        }
    }
  }

  const isCurrentlyViolated = !!(activeAlarms && activeAlarms[effectiveAlarmKey]);
  const isViolatedAndDisplayable = isCurrentlyViolated && currentValue !== t.valueNotAvailable;

  let containerClasses = `${baseClasses} ${clickableClasses}`;
  let labelColor = "text-gray-300";
  let valueAndUnitColor = initialValueColorClass || "text-gray-100";
  let valueInlineStyle = {};

  if (valueColorHex) {
    valueInlineStyle = { color: valueColorHex };
  }

  if (isViolatedAndDisplayable) {
    containerClasses += ` bg-red-600 border-red-700`; // Red background and border for violated alarm
    labelColor = "text-white";
    valueAndUnitColor = "text-white"; // This might be overridden by valueColorHex if specific coloring is needed during alarm
    if (valueColorHex) { // Ensure hex color is white if violated and hex is provided
        valueInlineStyle = { color: '#FFFFFF' };
    }
  } else {
    const normalBgClass = isEditable && currentValue !== t.valueNotAvailable 
      ? `bg-${themeColors.primary}/20 ${themeColors.border}` 
      : `bg-${themeColors.primary}/10 border-${themeColors.primaryDark}`;
    containerClasses += ` ${normalBgClass}`;
  }


  return (
    <div
      className={containerClasses}
      onClick={isEditable && currentValue !== t.valueNotAvailable ? handleClick : undefined}
      title={isEditable && currentValue !== t.valueNotAvailable ? `${t.modalEditTitlePrefix}${displayLabel}` : displayLabel}
    >
      <div className="flex items-center">
        {isAlarmSetForThisParam && currentValue !== t.valueNotAvailable && (
            <span className={`mr-1.5 text-yellow-400 ${isCurrentlyViolated ? 'animate-custom-pulse' : ''}`}>🔔</span>
        )}
        <span className={`text-xs font-medium ${labelColor}`}>{displayLabel}</span>
      </div>
      <span 
        className={`font-bold min-w-[70px] text-right tabular-nums ${isLarge ? 'text-xl' : 'text-base'} ${!valueColorHex ? valueAndUnitColor : ''}`}
        style={valueInlineStyle}
      >
        {displayValue} {displayUnit && unitKey !== 'unit_ml_kg' && unitKey !== 'unit_none' ? displayUnit : (unitKey === 'unit_ml_kg' && displayValue !== t.valueNotAvailable ? displayUnit : '')}
      </span>
    </div>
  );
};


export const VitalSignItem: React.FC<ParameterItemProps> = ({ 
    paramKey, currentValue, currentTheme, onClick, overrideLabel, valueColorHex, alarmSettings, activeAlarms, operatingMode, icuSubMode, alarmAssociationKey
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const definition = PARAMETER_DEFINITIONS[paramKey];

  if (!definition) return null;
  const { labelKey, unitKey, isEditable } = definition;
  const displayLabel = overrideLabel || t[labelKey];
  const displayUnit = t[unitKey];

   const handleClick = () => {
    if (onClick && isEditable) {
      onClick(paramKey, displayLabel, currentValue, displayUnit);
    }
  };
  
  const effectiveAlarmKey = alarmAssociationKey || (paramKey as AlarmParameterKey);
  const isAlarmableParam = Object.keys(ALARMABLE_PARAMETERS_CONFIG).includes(effectiveAlarmKey as string);
  let isAlarmSetForThisParam = false;
  if (isAlarmableParam && alarmSettings && alarmSettings[effectiveAlarmKey]) {
     const alarmConfig = ALARMABLE_PARAMETERS_CONFIG[effectiveAlarmKey];
     if (alarmConfig) { 
        const displayConditionMet = alarmConfig.displayCondition ? alarmConfig.displayCondition(operatingMode ?? undefined, icuSubMode ?? undefined) : true;
        isAlarmSetForThisParam = alarmSettings[effectiveAlarmKey].isOn && displayConditionMet;
     }
  }
  
  const isCurrentlyViolated = !!(activeAlarms && activeAlarms[effectiveAlarmKey]);
  const isViolatedAndDisplayable = isCurrentlyViolated && currentValue !== t.valueNotAvailable;
  
  let containerClasses = `flex justify-between items-center mb-2 p-1.5 rounded-md border-l-4 ${isEditable ? `cursor-pointer hover:bg-${themeColors.primary}/20 hover:translate-x-0.5` : 'cursor-default'} transition-all duration-300`;
  let labelColor = `text-xs text-${themeColors.primaryLight}`;
  let valueColorClassOnly = `text-sm font-bold tabular-nums text-${themeColors.primaryLight}`; // Fallback if no hex
  let valueInlineStyle = {};

  if (valueColorHex) {
    valueInlineStyle = { color: valueColorHex };
  }

  if (isViolatedAndDisplayable) {
    containerClasses += ` bg-red-600 border-red-700`;
    labelColor = `text-xs text-white`;
    valueColorClassOnly = `text-sm font-bold tabular-nums text-white`;
     if (valueColorHex) { // Ensure hex color is white if violated and hex is provided
        valueInlineStyle = { color: '#FFFFFF' };
    }
  } else {
    containerClasses += ` bg-${themeColors.primary}/10 ${themeColors.border}`;
  }


  return (
    <div 
      className={containerClasses}
      onClick={isEditable ? handleClick : undefined}
      title={isEditable ? `${t.modalEditTitlePrefix}${displayLabel}` : displayLabel}
    >
      <div className="flex items-center">
        {isAlarmSetForThisParam && <span className={`mr-1 text-yellow-400 ${isCurrentlyViolated ? 'animate-custom-pulse' : ''}`}>🔔</span>}
        <span className={labelColor}>{displayLabel}</span>
      </div>
      <span className={`${!valueColorHex ? valueColorClassOnly : 'text-sm font-bold tabular-nums'}`} style={valueInlineStyle}>
        {currentValue} {displayUnit}
      </span>
    </div>
  );
};
