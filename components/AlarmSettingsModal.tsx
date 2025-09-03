

import React, { useState, useEffect, useMemo } from 'react';
import { ALARMABLE_PARAMETERS_CONFIG, THEME_CONFIG, INITIAL_ALARM_SETTINGS, HIGH_FLOW_ADULT_FGF_MIN, HIGH_FLOW_ADULT_FGF_MAX, HIGH_FLOW_PEDIATRIC_FGF_MIN, HIGH_FLOW_PEDIATRIC_FGF_MAX } from '../constants';
import { AlarmSettings, AlarmParameterKey, OperatingMode, ICUSubMode, AlarmLimits, ThemeName, HighFlowInterfaceType } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';
import { TouchSlider } from './TouchSlider'; // Import the new TouchSlider component

interface AlarmSettingsModalProps {
  isOpen: boolean;
  currentSettings: AlarmSettings;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  highFlowInterfaceType: HighFlowInterfaceType | null; // Added prop
  currentTheme: ThemeName;
  onConfirm: (settings: AlarmSettings) => void;
  onClose: () => void;
}

const ToggleSwitch: React.FC<{
  isOn: boolean;
  onChange: () => void;
  themeColors: typeof THEME_CONFIG[ThemeName];
  title?: string;
  size?: 'small' | 'medium';
}> = ({ isOn, onChange, themeColors, title, size = 'medium' }) => {
  const heightClass = size === 'small' ? 'h-5 w-9' : 'h-6 w-11';
  const dotSizeClass = size === 'small' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const translateClass = size === 'small'
    ? (isOn ? 'translate-x-4' : 'translate-x-0.5')
    : (isOn ? 'translate-x-5' : 'translate-x-1');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={onChange}
      className={`relative inline-flex items-center ${heightClass} flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-${themeColors.accent}
                  ${isOn ? `bg-${themeColors.accent}` : 'bg-gray-500'}`}
      title={title}
    >
      <span
        aria-hidden="true"
        className={`inline-block ${dotSizeClass} transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                    ${translateClass}`}
      />
    </button>
  );
};


export const AlarmSettingsModal: React.FC<AlarmSettingsModalProps> = ({
    isOpen, currentSettings, operatingMode, icuSubMode, highFlowInterfaceType, currentTheme, onConfirm, onClose
}) => {
  const [settings, setSettings] = useState<AlarmSettings>(currentSettings);
  const [allAlarmsActive, setAllAlarmsActive] = useState<boolean>(true);
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  const isHighFlowMode = operatingMode === 'icu' && icuSubMode === 'high-flow';

  const filteredAlarmKeys = useMemo(() =>
    (Object.keys(ALARMABLE_PARAMETERS_CONFIG) as AlarmParameterKey[])
    .filter(key => {
      const config = ALARMABLE_PARAMETERS_CONFIG[key];
      if (!config) return false;
      if (config.displayCondition && !config.displayCondition(operatingMode ?? undefined, icuSubMode ?? undefined)) {
        return false;
      }
      // Specific filter for HF mode to only show relevant alarms
      if (isHighFlowMode) {
         return key === 'fio2' || key === 'deliveredFlow' || key === 'checkWater' || key === 'cannotReachTargetFlow' || key === 'checkTube';
      }
      return true;
    }), [operatingMode, icuSubMode, isHighFlowMode]);


  useEffect(() => {
    if (isOpen) {
      const initialisedSettings: AlarmSettings = JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS));

      filteredAlarmKeys.forEach(paramKey => {
        if (currentSettings[paramKey]) {
            initialisedSettings[paramKey] = { ...initialisedSettings[paramKey], ...currentSettings[paramKey] };
        }
        if (initialisedSettings[paramKey] && initialisedSettings[paramKey].isOn === undefined) {
          initialisedSettings[paramKey].isOn = true;
        }
      });
      setSettings(initialisedSettings);

      const allCurrentlyOn = filteredAlarmKeys.every(key => initialisedSettings[key]?.isOn);
      setAllAlarmsActive(allCurrentlyOn);
    }
  }, [isOpen, currentSettings, filteredAlarmKeys]);


  if (!isOpen) return null;

  const handleSliderChange = (paramKey: AlarmParameterKey, limitType: 'low' | 'high', value: number) => {
    setSettings(prev => ({
      ...prev,
      [paramKey]: {
        ...prev[paramKey],
        [limitType]: value,
      } as AlarmLimits
    }));
  };

  const handleToggleChange = (paramKey: AlarmParameterKey) => {
    setSettings(prev => {
        const newSettings = {
            ...prev,
            [paramKey]: {
              ...prev[paramKey],
              isOn: !prev[paramKey].isOn,
            } as AlarmLimits
        };
        const allNowOn = filteredAlarmKeys.every(key => newSettings[key]?.isOn);
        setAllAlarmsActive(allNowOn);
        return newSettings;
    });
  };

  const handleToggleAllAlarms = () => {
    const newAllAlarmsState = !allAlarmsActive;
    setAllAlarmsActive(newAllAlarmsState);
    setSettings(prev => {
        const newSettings = { ...prev };
        filteredAlarmKeys.forEach(paramKey => {
            newSettings[paramKey] = {
                ...(prev[paramKey] || INITIAL_ALARM_SETTINGS[paramKey]),
                isOn: newAllAlarmsState,
            } as AlarmLimits;
        });
        return newSettings;
    });
  };

  const handleConfirm = () => {
    onConfirm(settings);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 transition-opacity duration-300"
        onClick={onClose}
    >
      <div
        className={`bg-gray-800 p-5 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h3 className={`text-lg font-semibold text-${themeColors.accent} mb-4 text-center`}>{t.alarmSettingsTitle}</h3>

        <div className="hidden md:grid grid-cols-[1.5fr_auto_1fr_1fr] items-center gap-x-3 px-2 pb-1 mb-1 border-b border-gray-700">
          <span className="text-xs text-gray-400 font-medium">{t.alarmNameColumnLabel}</span>
          <span className="text-xs text-gray-400 font-medium justify-self-center">{t.alarmActiveColumnLabel}</span>
          <span className="text-xs text-gray-400 font-medium text-left pl-2">{t.alarmLimitLowLabel}</span>
          <span className="text-xs text-gray-400 font-medium text-left pl-2">{t.alarmLimitHighLabel}</span>
        </div>

        <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
          {filteredAlarmKeys.map((paramKey) => {
            const config = ALARMABLE_PARAMETERS_CONFIG[paramKey];
            if (!config) return null;

            const alarmIsOn = settings[paramKey]?.isOn ?? true;

            let showLowInput = !config.isLowOnly && !config.isHighOnly;
            let showHighInput = !config.isHighOnly && !config.isLowOnly;
             if (config.isHighOnly) showLowInput = false;
             if (config.isLowOnly) showHighInput = false;


            let currentMinLow = config.minLow ?? 0;
            let currentMaxLow = config.maxLow ?? 100;
            let currentMinHigh = config.minHigh ?? 1;
            let currentMaxHigh = config.maxHigh ?? 120;


            if (paramKey === 'fio2' && config.isHighOnlyDisplayCondition?.(operatingMode ?? undefined, icuSubMode ?? undefined)) {
                 showLowInput = false;
                 showHighInput = true; // Ensure high is shown if low is hidden for this specific condition
            }
             if (paramKey === 'cannotReachTargetFlow' && config.isLowOnly) {
                showHighInput = false;
                showLowInput = true;
            }


            if (paramKey === 'deliveredFlow' && isHighFlowMode && highFlowInterfaceType) {
                if (highFlowInterfaceType === 'adult') {
                    currentMinLow = 5; currentMaxLow = Math.min(HIGH_FLOW_ADULT_FGF_MAX - 5, 55);
                    currentMinHigh = Math.max(HIGH_FLOW_ADULT_FGF_MIN + 5, 15); currentMaxHigh = 70;
                } else { // Junior
                    currentMinLow = 1; currentMaxLow = Math.min(HIGH_FLOW_PEDIATRIC_FGF_MAX - 1, 20);
                    currentMinHigh = Math.max(HIGH_FLOW_PEDIATRIC_FGF_MIN + 1, 3); currentMaxHigh = 30;
                }
            }


            return (
              <div key={paramKey} className={`p-2 bg-gray-700/40 rounded-md border border-gray-600/50`}>
                <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-gray-200 text-sm truncate font-medium ${!alarmIsOn ? 'opacity-60' : ''}`} title={t[config.labelKey]}>
                        {t[config.labelKey]}
                    </span>
                    {!config.isToggleOnly && (
                        <ToggleSwitch
                            isOn={alarmIsOn}
                            onChange={() => handleToggleChange(paramKey)}
                            themeColors={themeColors}
                            size="small"
                            title={alarmIsOn ? t.statusOn : t.statusOff}
                        />
                    )}
                </div>

                {!config.isToggleOnly ? (
                  <div className={`grid grid-cols-1 ${ (showLowInput && showHighInput) ? 'md:grid-cols-2' : 'md:grid-cols-1' } gap-x-3 gap-y-1 ${!alarmIsOn ? 'opacity-50 pointer-events-none' : ''}`}>
                      {showLowInput && (
                          <TouchSlider
                              label={t.alarmLimitLowLabel}
                              min={currentMinLow}
                              max={currentMaxLow}
                              step={config.stepLow}
                              initialValue={settings[paramKey]?.low ?? currentMinLow}
                              unit={t[config.unitKey]}
                              themeColors={themeColors}
                              onChange={(val) => handleSliderChange(paramKey, 'low', val)}
                              disabled={!alarmIsOn}
                          />
                      )}
                      {showHighInput && (
                           <TouchSlider
                              label={t.alarmLimitHighLabel}
                              min={currentMinHigh}
                              max={currentMaxHigh}
                              step={config.stepHigh}
                              initialValue={settings[paramKey]?.high ?? currentMaxHigh}
                              unit={t[config.unitKey]}
                              themeColors={themeColors}
                              onChange={(val) => handleSliderChange(paramKey, 'high', val)}
                              disabled={!alarmIsOn}
                          />
                      )}
                  </div>
                ) : ( // For toggle-only alarms like "Check Water"
                  <div className="flex justify-end">
                     <ToggleSwitch
                        isOn={alarmIsOn}
                        onChange={() => handleToggleChange(paramKey)}
                        themeColors={themeColors}
                        size="medium"
                        title={alarmIsOn ? t.statusOn : t.statusOff}
                    />
                  </div>
                )}
                 {!showLowInput && !showHighInput && !config.isToggleOnly && <div className="h-2"></div> /* Placeholder if no sliders and not toggle only */}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-end space-x-3 px-1">
          <span className="text-xs text-gray-300">{t.allAlarmsToggleLabel}</span>
          <ToggleSwitch
            isOn={allAlarmsActive}
            onChange={handleToggleAllAlarms}
            themeColors={themeColors}
            title={allAlarmsActive ? t.statusOn : t.statusOff}
          />
        </div>


        <div className="flex gap-4 justify-center mt-5">
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-green-600 text-white rounded-md font-semibold hover:bg-green-500 transition-colors text-sm"
          >
            {t.modalConfirm}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-500 transition-colors text-sm"
          >
            {t.modalCancel}
          </button>
        </div>
      </div>
    </div>
  );
};