import React, { useState, useEffect, useCallback } from 'react';
import {
  SimulatorSettings, AnestheticGasType, PatientGender, PatientPhysiologyPresetKey,
  PostScreenKey, ThemeName, DefaultAnestheticAgentSetting, VentilationMode, SimulatorSettingsModalState, LastDisinfectionStatus, PatientPhysiologySettings
} from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path
import { THEME_CONFIG, GAS_CONFIG, ANESTHETIC_GAS_ORDER, POST_SCREEN_CONFIG, PATIENT_PHYSIOLOGY_PRESETS_CONFIG, INITIAL_SIMULATOR_SETTINGS, VENT_MODES_CONFIG, HIGH_FLOW_PEDIATRIC_FGF_MIN, HIGH_FLOW_ADULT_FGF_MIN, HIGH_FLOW_TEMP_DEFAULT_ADULT, HIGH_FLOW_TEMP_DEFAULT_JUNIOR, INITIAL_PARAMETERS } from '../constants';
import { TouchNumericInput } from './TouchNumericInput'; // Import the new component
import { TouchSlider } from './TouchSlider';
import { TranslationKeys } from '../src/i18n/locales';


interface SimulatorSettingsModalProps {
  isOpen: boolean;
  currentSettings: SimulatorSettings;
  onConfirm: (settings: SimulatorSettings) => void;
  onClose: () => void;
}

type ActiveTab = SimulatorSettingsModalState['activeTab'];

interface EditingNumericInfo {
  path: string[];
  title: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  showKeypad?: boolean;
}


const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; themeColors: typeof THEME_CONFIG.anesthesia }> = ({ label, isActive, onClick, themeColors }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors flex-1 md:flex-none
                ${isActive
                  ? `bg-${themeColors.primary} text-white border-b-2 border-${themeColors.accent}`
                  : `bg-gray-700 text-gray-300 hover:bg-gray-600`}`}
  >
    {label}
  </button>
);

const inputBaseClasses = (themeColors: typeof THEME_CONFIG.anesthesia) =>
  `w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-1 focus:ring-${themeColors.accent} focus:border-${themeColors.accent} outline-none text-sm`;

const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-md font-semibold text-gray-200 mt-3 mb-2 border-b border-gray-700 pb-1">{children}</h4>
);

const SettingsFieldDisplay: React.FC<{label: string, value: string | number | null | undefined, unit?: string, onEdit: () => void, themeColors: typeof THEME_CONFIG.anesthesia, subText?: string}> =
    ({label, value, unit, onEdit, themeColors, subText}) => (
    <div className="mb-2.5">
        <label className="block text-xs font-medium text-gray-400 mb-0.5">{label}</label>
        <button
            onClick={onEdit}
            className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-1 focus:ring-${themeColors.accent} focus:border-${themeColors.accent} outline-none text-sm text-left flex justify-between items-center h-9`}
        >
            <span>{value ?? '--'} {unit}</span>
            <span className="text-xs">✏️</span>
        </button>
        {subText && <p className="text-2xs text-gray-500 mt-0.5">{subText}</p>}
    </div>
);

const ReadOnlyDisplayField: React.FC<{label: string, value: string, unit?: string, themeColors: typeof THEME_CONFIG.anesthesia, subText?: string}> =
    ({label, value, unit, themeColors, subText}) => (
    <div className="mb-2.5">
        <label className="block text-xs font-medium text-gray-400 mb-0.5">{label}</label>
        <div
            className={`w-full p-2 bg-gray-700/50 border border-gray-600/70 text-gray-200 rounded-md text-sm h-9 flex items-center`}
        >
            <span>{value} {unit}</span>
        </div>
        {subText && <p className="text-2xs text-gray-500 mt-0.5">{subText}</p>}
    </div>
);


export const SimulatorSettingsModal: React.FC<SimulatorSettingsModalProps> = ({ isOpen, currentSettings, onConfirm, onClose }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG.icu;

  const [activeTab, setActiveTab] = useState<ActiveTab>('general'); // Default to General
  const [settings, setSettings] = useState<SimulatorSettings>(INITIAL_SIMULATOR_SETTINGS);
  const [editingNumeric, setEditingNumeric] = useState<EditingNumericInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
        const newSettingsCopy = JSON.parse(JSON.stringify(currentSettings));
        // Ensure all POST keys exist in the settings copy
        (Object.keys(POST_SCREEN_CONFIG) as PostScreenKey[]).forEach(postKey => {
            if (!newSettingsCopy.general[postKey]) {
                 newSettingsCopy.general[postKey] = {
                    performed: false,
                    dateTime: null,
                    ...(postKey === 'high_flow_post' && { lastDisinfectionStatus: 'clean' as LastDisinfectionStatus })
                 };
            }
             if (postKey === 'high_flow_post' && newSettingsCopy.general.high_flow_post.lastDisinfectionStatus === undefined) {
                newSettingsCopy.general.high_flow_post.lastDisinfectionStatus = 'clean';
            }
        });
         if (!newSettingsCopy.highFlow.hasOwnProperty('defaultFio2HighFlow')) {
            newSettingsCopy.highFlow.defaultFio2HighFlow = INITIAL_SIMULATOR_SETTINGS.highFlow.defaultFio2HighFlow;
        }


        setSettings(newSettingsCopy);
        setActiveTab('general'); // Default to General on open
        setEditingNumeric(null);
    }
  }, [isOpen, currentSettings]);

  const handleConfirm = () => {
    onConfirm(settings);
  };

  const handleResetToDefaults = () => {
    const defaultSettingsCopy = JSON.parse(JSON.stringify(INITIAL_SIMULATOR_SETTINGS));
     // Ensure all POST keys exist in the default settings copy after reset
    (Object.keys(POST_SCREEN_CONFIG) as PostScreenKey[]).forEach(postKey => {
        if (!defaultSettingsCopy.general[postKey]) {
             defaultSettingsCopy.general[postKey] = {
                performed: false,
                dateTime: null,
                ...(postKey === 'high_flow_post' && { lastDisinfectionStatus: 'clean' as LastDisinfectionStatus })
             };
        }
        if (postKey === 'high_flow_post' && defaultSettingsCopy.general.high_flow_post.lastDisinfectionStatus === undefined) {
            defaultSettingsCopy.general.high_flow_post.lastDisinfectionStatus = 'clean';
        }
    });
    if (!defaultSettingsCopy.highFlow.hasOwnProperty('defaultFio2HighFlow')) {
        defaultSettingsCopy.highFlow.defaultFio2HighFlow = INITIAL_SIMULATOR_SETTINGS.highFlow.defaultFio2HighFlow;
    }
    setSettings(defaultSettingsCopy);
  };

  const updateNestedSetting = (path: string[], value: any) => {
    setSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev));
      let currentLevel: any = newSettings;
      path.forEach((key, index) => {
        if (index === path.length - 1) {
          currentLevel[key] = value;
        } else {
          if (!currentLevel[key]) {
            const nextKeyInPath = path[index+1];
            currentLevel[key] = typeof nextKeyInPath === 'number' || (typeof nextKeyInPath === 'string' && !isNaN(parseInt(nextKeyInPath))) ? [] : {};
          }
          currentLevel = currentLevel[key];
        }
      });
      return newSettings;
    });
  };


  const handleNumericEditConfirm = (valueStr: string) => {
    if (editingNumeric) {
      const { path, allowDecimal } = editingNumeric;
      let finalValue: string | number = valueStr;
      if (allowDecimal === false) {
          finalValue = parseInt(valueStr, 10);
      } else {
          finalValue = parseFloat(valueStr);
      }
      if (isNaN(finalValue as number)) finalValue = editingNumeric.min ?? 0;

      // Check if this is a physiology parameter change
      const isPhysiologyParam = path.length > 1 && path[0] === 'patientProfile' &&
                                ['spontaneousRate', 'compliance', 'resistance'].includes(path[1]);
      
      if (isPhysiologyParam) {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            let currentLevel: any = newSettings;
            // Safely navigate path
            for (let i = 0; i < path.length - 1; i++) {
                if (currentLevel[path[i]] === undefined) {
                    // Path doesn't exist, can't update, return prev state
                    return prev;
                }
                currentLevel = currentLevel[path[i]];
            }
            currentLevel[path[path.length - 1]] = finalValue;

            // also clear preset
            if (newSettings.patientProfile) {
                newSettings.patientProfile.selectedPreset = null;
            }
            return newSettings;
        });
      } else {
        updateNestedSetting(path, finalValue);
      }
    }
    setEditingNumeric(null);
  };
  
  const handleWaveformFactorChange = (factorKey: keyof PatientPhysiologySettings, value: number) => {
    setSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev));
      if (newSettings.patientProfile) {
        (newSettings.patientProfile as any)[factorKey] = value;
        newSettings.patientProfile.selectedPreset = null; // Clear preset
      }
      return newSettings;
    });
  };


  const handleVaporizerChange = (index: number, field: 'gas' | 'level', value: any) => {
    const vaporizers = [...settings.anesthesia.vaporizers];
    if (!vaporizers[index] && field === 'gas') {
        const existingGases = vaporizers.map(v => v.gas);
        const nextGas = ANESTHETIC_GAS_ORDER.find(g => !existingGases.includes(g));
        if(nextGas){
            vaporizers[index] = { gas: value as AnestheticGasType, level: 100 };
        }
    } else if(vaporizers[index]) {
        (vaporizers[index] as any)[field] = value;
    }
    updateNestedSetting(['anesthesia', 'vaporizers'], vaporizers.filter(v => v && v.gas));
  };

  const handleRemoveVaporizer = (index: number) => {
    const updatedVaporizers = settings.anesthesia.vaporizers.filter((_, i) => i !== index);
    updateNestedSetting(['anesthesia', 'vaporizers'], updatedVaporizers);
  };

  const handleAddVaporizer = () => {
    if (settings.anesthesia.vaporizers.length < 2) {
      const existingGases = settings.anesthesia.vaporizers.map(v => v.gas);
      const nextGas = ANESTHETIC_GAS_ORDER.find(g => !existingGases.includes(g));
      if (nextGas) {
        updateNestedSetting(['anesthesia', 'vaporizers'], [...settings.anesthesia.vaporizers, { gas: nextGas, level: 100 }]);
      }
    }
  };

  const handlePresetChange = (presetKey: PatientPhysiologyPresetKey | '') => {
    if (presetKey === '') {
        updateNestedSetting(['patientProfile', 'selectedPreset'], null);
    } else {
        const presetValues = PATIENT_PHYSIOLOGY_PRESETS_CONFIG[presetKey];
        const newPatientProfile = {
            ...settings.patientProfile,
            ...presetValues,
            selectedPreset: presetKey,
        };
        updateNestedSetting(['patientProfile'], newPatientProfile);
    }
  };

  const handlePostTestChange = (postKey: PostScreenKey, field: 'performed' | 'dateTime', value: any) => {
     const newPostSetting = { ...(settings.general[postKey] || { performed: false, dateTime: null, ...(postKey === 'high_flow_post' && { lastDisinfectionStatus: 'clean' }) }) };
     (newPostSetting as any)[field] = value;

     if (field === 'performed' && !value) {
         newPostSetting.dateTime = null;
     } else if (field === 'performed' && value && !newPostSetting.dateTime) {
         newPostSetting.dateTime = new Date().toISOString().slice(0, 16);
     }
     updateNestedSetting(['general', postKey], newPostSetting);
  };

  const handleDisinfectionStatusChange = (postKey: PostScreenKey, value: LastDisinfectionStatus) => {
    const newPostSetting = { ...(settings.general[postKey] || { performed: false, dateTime: null, lastDisinfectionStatus: 'clean' }) };
    newPostSetting.lastDisinfectionStatus = value;
    updateNestedSetting(['general', postKey], newPostSetting);
  };


  if (!isOpen) return null;

  if (editingNumeric) {
    let initialValForEdit = '';
    let currentValAtPath: any = settings;
    editingNumeric.path.forEach(key => {
        currentValAtPath = currentValAtPath?.[key];
    });
    initialValForEdit = currentValAtPath !== undefined && currentValAtPath !== null ? String(currentValAtPath) : String(editingNumeric.min || 0);

    return (
        <TouchNumericInput
            initialValue={initialValForEdit}
            title={editingNumeric.title}
            unit={editingNumeric.unit || ''}
            min={editingNumeric.min}
            max={editingNumeric.max}
            step={editingNumeric.step}
            allowDecimal={editingNumeric.allowDecimal}
            showKeypad={editingNumeric.showKeypad ?? true}
            themeColors={themeColors}
            onConfirm={handleNumericEditConfirm}
            onClose={() => setEditingNumeric(null)}
        />
    )
  }

  const renderAnesthesiaTab = () => (
    <div className="space-y-4">
      <SubHeading>{t.anesthesiaSettings_subheading_vaporizers}</SubHeading>
      <p className="text-xs text-gray-400 mb-2">{t.anesthesiaSettings_selectVaporizersLabel}</p>
      {settings.anesthesia.vaporizers.map((vaporizer, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border border-gray-600 rounded-md mb-2">
          <span className="text-xs text-gray-400 mr-1">{t.anesthesiaSettings_vaporizer} {index + 1}:</span>
          <select
            value={vaporizer.gas}
            onChange={(e) => handleVaporizerChange(index, 'gas', e.target.value as AnestheticGasType)}
            className={`${inputBaseClasses(themeColors)} flex-1 h-9`}
          >
            {ANESTHETIC_GAS_ORDER.map(gasKey => (
              <option key={gasKey} value={gasKey} disabled={settings.anesthesia.vaporizers.some((v, i) => i !== index && v.gas === gasKey)}>
                {t[GAS_CONFIG[gasKey].nameKey]}
              </option>
            ))}
          </select>
          <div className="flex-1">
             <TouchSlider
                label=""
                min={0} max={100} step={1} initialValue={vaporizer.level} unit="%"
                themeColors={themeColors}
                onChange={(val) => handleVaporizerChange(index, 'level', val)}
            />
          </div>
          <button onClick={() => handleRemoveVaporizer(index)} className="text-red-500 hover:text-red-400 text-xs p-1 h-9 flex items-center" title="Remove Vaporizer">🗑️</button>
        </div>
      ))}
      {settings.anesthesia.vaporizers.length < 2 && (
        <button onClick={handleAddVaporizer} className={`text-xs ${themeColors.textOnPrimary} bg-${themeColors.accent} hover:opacity-90 px-2 py-1.5 rounded h-9`}>
          + Add Vaporizer
        </button>
      )}

      <SubHeading>{t.anesthesiaSettings_subheading_circuitConsumables}</SubHeading>
        <TouchSlider
            label={t.anesthesiaSettings_sodaLimeLabel}
            min={0} max={100} step={1} initialValue={settings.anesthesia.sodaLimeRemainingPercent} unit="%"
            themeColors={themeColors}
            onChange={(val) => updateNestedSetting(['anesthesia', 'sodaLimeRemainingPercent'], val)}
        />
        <p className="text-2xs text-gray-500 mt-0.5">{t.anesthesiaSettings_sodaLimeWarning}</p>


      <SubHeading>{t.anesthesiaSettings_subheading_defaultParams}</SubHeading>
       <SettingsFieldDisplay label={t.anesthesiaSettings_defaultFGFLabel} value={settings.anesthesia.defaultFGF} unit="L/min" onEdit={() => setEditingNumeric({ path:['anesthesia','defaultFGF'], title: t.anesthesiaSettings_defaultFGFLabel, unit:"L/min", min:0, max:15, step:1, allowDecimal: false, showKeypad: false})} themeColors={themeColors} />
       <SettingsFieldDisplay label={t.anesthesiaSettings_defaultAPLLabel} value={settings.anesthesia.defaultAPL} unit="cmH₂O" onEdit={() => setEditingNumeric({ path:['anesthesia','defaultAPL'], title: t.anesthesiaSettings_defaultAPLLabel, unit:"cmH₂O", min:0, max:70, step:1, allowDecimal: false, showKeypad: false})} themeColors={themeColors} />
       <SettingsFieldDisplay label={t.anesthesiaSettings_defaultTargetMACLabel} value={settings.anesthesia.defaultTargetMAC} unit="MAC" onEdit={() => setEditingNumeric({ path:['anesthesia','defaultTargetMAC'], title: t.anesthesiaSettings_defaultTargetMACLabel, unit:"MAC", min:0.1, max:3, step:0.1, allowDecimal: true, showKeypad: false})} themeColors={themeColors} />
    </div>
  );

  const renderPatientProfileTab = () => {
    const vtRef = INITIAL_PARAMETERS.volume;
    const peepRef = settings.ventilationDefaults.defaultInitialPeep;
    const currentCompliance = settings.patientProfile.compliance;

    let pplatEstText = t.valueNotAvailable;
    let pdriveEstText = t.valueNotAvailable;

    if (currentCompliance && currentCompliance > 0 && peepRef !== null) {
        const pplatEstNum = (vtRef / currentCompliance) + peepRef;
        const pdriveEstNum = pplatEstNum - peepRef;
        pplatEstText = pplatEstNum.toFixed(1);
        pdriveEstText = pdriveEstNum.toFixed(1);
    }
    
    return (
        <div className="space-y-3">
            <SubHeading>{t.patientProfileSettings_subheading_demographics}</SubHeading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SettingsFieldDisplay label={t.patientAgeLabel} value={settings.patientProfile.age} onEdit={() => setEditingNumeric({path: ['patientProfile', 'age'], title:t.patientAgeLabel, min:0, max:120, step:1, allowDecimal:false, showKeypad: true})} themeColors={themeColors} />
                <div className="mb-2.5">
                    <label htmlFor="gender" className="block text-xs font-medium text-gray-400 mb-0.5">{t.patientGenderLabel}</label>
                    <select id="gender" value={settings.patientProfile.gender || ''} onChange={(e) => updateNestedSetting(['patientProfile', 'gender'], e.target.value as PatientGender)} className={`${inputBaseClasses(themeColors)} h-9`}>
                        <option value="" disabled>{t.modalEditTitlePrefix}...</option>
                        <option value={PatientGender.MALE}>{t.genderMale}</option>
                        <option value={PatientGender.FEMALE}>{t.genderFemale}</option>
                        <option value={PatientGender.OTHER}>{t.genderOther}</option>
                    </select>
                </div>
                <SettingsFieldDisplay label={t.patientWeightLabel} value={settings.patientProfile.weight} unit="kg" onEdit={() => setEditingNumeric({path: ['patientProfile', 'weight'], title:t.patientWeightLabel, unit:"kg", min:0.1, max:300, step:0.1, allowDecimal:true, showKeypad: true})} themeColors={themeColors} />
            </div>

            <SubHeading>{t.patientProfileSettings_subheading_physiology}</SubHeading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SettingsFieldDisplay label={t.ventilationSettings_spontaneousRateLabel} value={settings.patientProfile.spontaneousRate} unit="bpm" onEdit={() => setEditingNumeric({path:['patientProfile','spontaneousRate'], title:t.ventilationSettings_spontaneousRateLabel, unit:"bpm", min:0, max:60, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />
                <SettingsFieldDisplay label={t.ventilationSettings_complianceLabel} value={settings.patientProfile.compliance} unit="ml/cmH₂O" onEdit={() => setEditingNumeric({path:['patientProfile','compliance'], title:t.ventilationSettings_complianceLabel, unit:"ml/cmH₂O", min:1, max:150, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />
                <SettingsFieldDisplay label={t.ventilationSettings_resistanceLabel} value={settings.patientProfile.resistance} unit="cmH₂O/L/s" onEdit={() => setEditingNumeric({path:['patientProfile','resistance'], title:t.ventilationSettings_resistanceLabel, unit:"cmH₂O/L/s", min:1, max:50, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <ReadOnlyDisplayField
                    label={t.estimatedPlateauPressureLabel}
                    value={pplatEstText}
                    unit="cmH₂O"
                    themeColors={themeColors}
                    subText={t.estimatedValuesPPlatSubText}
                />
                <ReadOnlyDisplayField
                    label={t.estimatedDrivingPressureLabel}
                    value={pdriveEstText}
                    unit="cmH₂O"
                    themeColors={themeColors}
                    subText={t.estimatedValuesPDrSubText}
                />
            </div>
             <SubHeading>{t.patientProfileSettings_subheading_waveformFactors}</SubHeading>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <TouchSlider
                    label={t.simulatorSettings_expiratoryEffortFactorLabel}
                    min={0} max={1} step={0.1} initialValue={settings.patientProfile.expiratoryEffortFactor ?? 0} unit=""
                    themeColors={themeColors}
                    onChange={(val) => handleWaveformFactorChange('expiratoryEffortFactor', val)}
                />
                <TouchSlider
                    label={t.simulatorSettings_inspiratoryEffortStrengthLabel}
                    min={0} max={1} step={0.1} initialValue={settings.patientProfile.inspiratoryEffortStrength ?? 0} unit=""
                    themeColors={themeColors}
                    onChange={(val) => handleWaveformFactorChange('inspiratoryEffortStrength', val)}
                />
                <TouchSlider
                    label={t.simulatorSettings_expiratoryFlowLimitationFactorLabel}
                    min={0} max={1} step={0.1} initialValue={settings.patientProfile.expiratoryFlowLimitationFactor ?? 0} unit=""
                    themeColors={themeColors}
                    onChange={(val) => handleWaveformFactorChange('expiratoryFlowLimitationFactor', val)}
                />
                <TouchSlider
                    label={t.simulatorSettings_secretionsFactorLabel}
                    min={0} max={1} step={0.1} initialValue={settings.patientProfile.secretionsFactor ?? 0} unit=""
                    themeColors={themeColors}
                    onChange={(val) => handleWaveformFactorChange('secretionsFactor', val)}
                />
            </div>


            <div className="mb-2.5">
                <label htmlFor="patientPreset" className="block text-xs font-medium text-gray-400 mb-0.5">{t.ventilationSettings_presetsLabel}</label>
                <select id="patientPreset" value={settings.patientProfile.selectedPreset || ''} onChange={(e) => handlePresetChange(e.target.value as PatientPhysiologyPresetKey | '')} className={`${inputBaseClasses(themeColors)} h-9`}>
                    <option value="">{t.preset_selectPrompt}</option>
                    {(Object.keys(PATIENT_PHYSIOLOGY_PRESETS_CONFIG) as PatientPhysiologyPresetKey[]).map(key => (
                        <option key={key} value={key}>{t[`preset_${key}`]}</option>
                    ))}
                </select>
            </div>
        </div>
    );
  }


  const renderVentilationDefaultsTab = () => (
    <div className="space-y-3">
        <SubHeading>{t.ventilationDefaultsSettings_subheading_initialParams}</SubHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingsFieldDisplay label={t.ventilationDefaults_defaultInitialFio2Label} value={settings.ventilationDefaults.defaultInitialFio2} unit="%" onEdit={() => setEditingNumeric({path:['ventilationDefaults','defaultInitialFio2'], title:t.ventilationDefaults_defaultInitialFio2Label, unit:"%", min:21, max:100, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />
            <SettingsFieldDisplay label={t.ventilationDefaults_defaultInitialPeepLabel} value={settings.ventilationDefaults.defaultInitialPeep} unit="cmH₂O" onEdit={() => setEditingNumeric({path:['ventilationDefaults','defaultInitialPeep'], title:t.ventilationDefaults_defaultInitialPeepLabel, unit:"cmH₂O", min:0, max:30, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />
        </div>

        <SubHeading>{t.ventilationDefaultsSettings_subheading_defaultModes}</SubHeading>
        <div className="mb-2.5">
            <label htmlFor="defaultModeICUInvasive" className="block text-xs font-medium text-gray-400 mb-0.5">{t.ventilationDefaults_defaultModeICUInvasiveLabel}</label>
            <select id="defaultModeICUInvasive" value={settings.ventilationDefaults.defaultModeICUInvasive} onChange={(e) => updateNestedSetting(['ventilationDefaults','defaultModeICUInvasive'], e.target.value as VentilationMode)} className={`${inputBaseClasses(themeColors)} h-9`}>
                {[VentilationMode.VC, VentilationMode.PC, VentilationMode.SIMV, VentilationMode.PS].map(mode => <option key={mode} value={mode}>{t[VENT_MODES_CONFIG[mode].nameKey]}</option>)}
            </select>
        </div>
        <div className="mb-2.5">
             <label htmlFor="defaultModeICUNonInvasive" className="block text-xs font-medium text-gray-400 mb-0.5">{t.ventilationDefaults_defaultModeICUNonInvasiveLabel}</label>
             <select id="defaultModeICUNonInvasive" value={settings.ventilationDefaults.defaultModeICUNonInvasive} onChange={(e) => updateNestedSetting(['ventilationDefaults','defaultModeICUNonInvasive'], e.target.value as VentilationMode)} className={`${inputBaseClasses(themeColors)} h-9`}>
                {[VentilationMode.CPAP, VentilationMode.PS].map(mode => <option key={mode} value={mode}>{t[VENT_MODES_CONFIG[mode].nameKey]}</option>)}
            </select>
        </div>
        <div className="mb-2.5">
            <label htmlFor="defaultModeAnesthesiaMechanical" className="block text-xs font-medium text-gray-400 mb-0.5">{t.ventilationDefaults_defaultModeAnesthesiaMechanicalLabel}</label>
            <select id="defaultModeAnesthesiaMechanical" value={settings.ventilationDefaults.defaultModeAnesthesiaMechanical} onChange={(e) => updateNestedSetting(['ventilationDefaults','defaultModeAnesthesiaMechanical'], e.target.value as VentilationMode)} className={`${inputBaseClasses(themeColors)} h-9`}>
                {[VentilationMode.VC, VentilationMode.PC, VentilationMode.PS].map(mode => <option key={mode} value={mode}>{t[VENT_MODES_CONFIG[mode].nameKey]}</option>)}
            </select>
        </div>
    </div>
  );

 const renderGeneralTab = () => {
    const displayedPostConfigurations: {
        configKey: PostScreenKey;
        labelKey: TranslationKeys;
        showDisinfectionControl?: boolean;
    }[] = [
        { configKey: 'anesthesia_post', labelKey: POST_SCREEN_CONFIG.anesthesia_post.deviceTitleKey },
        { configKey: 'icu_general_post', labelKey: 'ventilatorPowerOnTitle' as TranslationKeys },
        { configKey: 'high_flow_post', labelKey: POST_SCREEN_CONFIG.high_flow_post.deviceTitleKey, showDisinfectionControl: true }
    ];
    const disinfectionStatusOptions: { value: LastDisinfectionStatus; labelKey: TranslationKeys }[] = [
        { value: 'clean', labelKey: 'disinfectionStatus_clean' },
        { value: 'dirty', labelKey: 'disinfectionStatus_dirty' },
        { value: 'not_safe', labelKey: 'disinfectionStatus_not_safe' },
    ];


    return (
    <div className="space-y-3">
      <SubHeading>{t.generalSettings_subheading_post}</SubHeading>
      {displayedPostConfigurations.map(postConfig => {
        const currentPostSetting = settings.general[postConfig.configKey] || { performed: false, dateTime: null, ...(postConfig.configKey === 'high_flow_post' && { lastDisinfectionStatus: 'clean' }) };
        return (
            <div key={postConfig.configKey} className="p-2 border border-gray-600 rounded-md">
                <label className="block text-sm font-medium text-gray-300 mb-1">{t[postConfig.labelKey]}</label>
                <div className="flex items-center gap-4 mb-1">
                    <label className="flex items-center text-xs text-gray-400">
                    <input
                        type="checkbox"
                        checked={!!currentPostSetting.performed}
                        onChange={(e) => handlePostTestChange(postConfig.configKey, 'performed', e.target.checked)}
                        className={`mr-1.5 h-3.5 w-3.5 rounded border-gray-500 text-${themeColors.accent} focus:ring-${themeColors.accent}`}
                    />
                    {t.selfTest_performedLabel}
                    </label>
                    {(currentPostSetting.performed) && (
                    <div className="flex-1">
                        <label htmlFor={`${postConfig.configKey}-datetime`} className="sr-only">{t.selfTest_dateTimeLabel}</label>
                        <input
                        id={`${postConfig.configKey}-datetime`}
                        type="datetime-local"
                        value={currentPostSetting.dateTime || ''}
                        onChange={(e) => handlePostTestChange(postConfig.configKey, 'dateTime', e.target.value)}
                        className={`${inputBaseClasses(themeColors)} text-xs h-9`}
                        />
                    </div>
                    )}
                </div>
                {postConfig.showDisinfectionControl && postConfig.configKey === 'high_flow_post' && (
                     <div className="mt-1.5">
                        <label htmlFor={`${postConfig.configKey}-disinfection`} className="block text-xs font-medium text-gray-400 mb-0.5">{t.highFlowSettings_lastDisinfectionStatusLabel}</label>
                        <select
                            id={`${postConfig.configKey}-disinfection`}
                            value={currentPostSetting.lastDisinfectionStatus || 'clean'}
                            onChange={(e) => handleDisinfectionStatusChange(postConfig.configKey, e.target.value as LastDisinfectionStatus)}
                            className={`${inputBaseClasses(themeColors)} h-9`}
                        >
                            {disinfectionStatusOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        );
      })}

      <SubHeading>{t.generalSettings_subheading_humidifier}</SubHeading>
        <div className="mb-2.5">
            <label className="block text-xs font-medium text-gray-400 mb-0.5">{t.generalSettings_humidifierDefaultOnLabel}</label>
            <div className="flex items-center">
                <button onClick={() => updateNestedSetting(['general','humidifierDefaultOn'], true)} className={`px-3 py-1.5 text-xs rounded-l-md h-9 ${settings.general.humidifierDefaultOn ? `bg-${themeColors.accent} text-white` : 'bg-gray-600 text-gray-300'}`}>{t.generalSettings_toggleYes}</button>
                <button onClick={() => updateNestedSetting(['general','humidifierDefaultOn'], false)} className={`px-3 py-1.5 text-xs rounded-r-md h-9 ${!settings.general.humidifierDefaultOn ? `bg-${themeColors.accent} text-white` : 'bg-gray-600 text-gray-300'}`}>{t.generalSettings_toggleNo}</button>
            </div>
        </div>
        <SettingsFieldDisplay label={t.generalSettings_humidifierDefaultTempLabel} value={settings.general.humidifierDefaultTemp} unit="°C" onEdit={() => setEditingNumeric({path:['general','humidifierDefaultTemp'], title:t.generalSettings_humidifierDefaultTempLabel, unit:"°C", min:31, max:39, step:1, allowDecimal:false, showKeypad: false})} themeColors={themeColors} />

      <SubHeading>{t.generalSettings_subheading_alarms}</SubHeading>
        <div className="mb-2.5">
             <label className="block text-xs font-medium text-gray-400 mb-0.5">{t.generalSettings_resetAlarmsOnNewPatientLabel}</label>
             <div className="flex items-center">
                <button onClick={() => updateNestedSetting(['general','resetAlarmsOnNewPatient'], true)} className={`px-3 py-1.5 text-xs rounded-l-md h-9 ${settings.general.resetAlarmsOnNewPatient ? `bg-${themeColors.accent} text-white` : 'bg-gray-600 text-gray-300'}`}>{t.generalSettings_toggleYes}</button>
                <button onClick={() => updateNestedSetting(['general','resetAlarmsOnNewPatient'], false)} className={`px-3 py-1.5 text-xs rounded-r-md h-9 ${!settings.general.resetAlarmsOnNewPatient ? `bg-${themeColors.accent} text-white` : 'bg-gray-600 text-gray-300'}`}>{t.generalSettings_toggleNo}</button>
            </div>
        </div>
    </div>
    );
 };

 const renderHighFlowTab = () => (
    <div className="space-y-3">
        <SubHeading>{t.highFlowSettings_subheading_defaults}</SubHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingsFieldDisplay
                label={t.param_fgf_label}
                value={settings.highFlow.defaultFGFAdult}
                unit="L/min (Adult)"
                onEdit={() => setEditingNumeric({ path: ['highFlow', 'defaultFGFAdult'], title: `${t.param_fgf_label} (Adult)`, unit: "L/min", min: 10, max: 60, step: 1, allowDecimal: false, showKeypad: false })}
                themeColors={themeColors}
            />
            <SettingsFieldDisplay
                label={t.param_fgf_label}
                value={settings.highFlow.defaultFGFJunior}
                unit="L/min (Junior)"
                onEdit={() => setEditingNumeric({ path: ['highFlow', 'defaultFGFJunior'], title: `${t.param_fgf_label} (Junior)`, unit: "L/min", min: 2, max: 25, step: 1, allowDecimal: false, showKeypad: false })}
                themeColors={themeColors}
            />
            <SettingsFieldDisplay
                label={t.param_temperature_label}
                value={settings.highFlow.defaultTempAdult}
                unit="°C (Adult)"
                onEdit={() => setEditingNumeric({ path: ['highFlow', 'defaultTempAdult'], title: `${t.param_temperature_label} (Adult)`, unit: "°C", min: 31, max: 37, step: 3, allowDecimal: false, showKeypad: false })}
                themeColors={themeColors}
            />
            <SettingsFieldDisplay
                label={t.param_temperature_label}
                value={settings.highFlow.defaultTempJunior}
                unit="°C (Junior)"
                onEdit={() => setEditingNumeric({ path: ['highFlow', 'defaultTempJunior'], title: `${t.param_temperature_label} (Junior)`, unit: "°C", min: 31, max: 34, step: 3, allowDecimal: false, showKeypad: false })}
                themeColors={themeColors}
            />
             <SettingsFieldDisplay
                label={t.highFlowSettings_defaultFio2Label}
                value={settings.highFlow.defaultFio2HighFlow}
                unit="%"
                onEdit={() => setEditingNumeric({ path: ['highFlow', 'defaultFio2HighFlow'], title: t.highFlowSettings_defaultFio2Label, unit: "%", min: 21, max: 100, step: 1, allowDecimal: false, showKeypad: false })}
                themeColors={themeColors}
            />
        </div>
        <SettingsFieldDisplay
            label={t.highFlowSettings_initialWaterLevelLabel}
            value={settings.highFlow.initialWaterLevelPercent}
            unit="%"
            onEdit={() => setEditingNumeric({ path: ['highFlow', 'initialWaterLevelPercent'], title: t.highFlowSettings_initialWaterLevelLabel, unit: "%", min: 0, max: 100, step: 1, allowDecimal: false, showKeypad: false })}
            themeColors={themeColors}
        />
    </div>
);


  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border-2 border-${themeColors.border} flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-4 border-b border-gray-700`}>
            <h3 className={`text-xl font-semibold text-center text-${themeColors.accent}`}>{t.simulatorSettingsTitle}</h3>
        </div>

        <div className="flex flex-col md:flex-row px-2 pt-2 border-b border-gray-700 bg-gray-800/50 flex-wrap">
          <TabButton label={t.tabGeneral} isActive={activeTab === 'general'} onClick={() => setActiveTab('general')} themeColors={themeColors} />
          <TabButton label={t.tabPatient} isActive={activeTab === 'patientProfile'} onClick={() => setActiveTab('patientProfile')} themeColors={themeColors} />
          <TabButton label={t.tabAnesthesia} isActive={activeTab === 'anesthesia'} onClick={() => setActiveTab('anesthesia')} themeColors={themeColors} />
          <TabButton label={t.tabVentilation} isActive={activeTab === 'ventilationDefaults'} onClick={() => setActiveTab('ventilationDefaults')} themeColors={themeColors} />
          <TabButton label={t.tabHighFlow} isActive={activeTab === 'highFlow'} onClick={() => setActiveTab('highFlow')} themeColors={themeColors} />
        </div>

        <div className="p-5 overflow-y-auto flex-grow min-h-[300px]">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'patientProfile' && renderPatientProfileTab()}
          {activeTab === 'anesthesia' && renderAnesthesiaTab()}
          {activeTab === 'ventilationDefaults' && renderVentilationDefaultsTab()}
          {activeTab === 'highFlow' && renderHighFlowTab()}
        </div>

        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800/80 flex justify-between items-center">
          <button
            onClick={handleResetToDefaults}
            className={`px-4 py-2 text-xs rounded-md font-semibold h-10
                        bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors`}
          >
            {t.resetSettingsButton}
          </button>
          <div className="flex gap-3">
             <button
                onClick={onClose}
                className={`px-4 py-2 text-sm rounded-md font-semibold h-10
                            bg-gray-500 text-gray-200 hover:bg-gray-400 transition-colors`}
            >
                {t.modalCancel}
            </button>
            <button
                onClick={handleConfirm}
                className={`px-5 py-2 text-sm rounded-md font-semibold h-10
                            bg-green-600 text-white hover:bg-green-500 transition-colors`}
            >
                {t.saveSettingsButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};