
import React, { useState, useEffect } from 'react';
import { PatientPhysiologySettings, PatientPhysiologyPresetKey, ThemeName, PatientPhysiologyPresetKey as PresetKey } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';
import { THEME_CONFIG, PATIENT_PHYSIOLOGY_PRESETS_CONFIG, INITIAL_PARAMETERS } from '../constants';
import { TouchNumericInput } from './TouchNumericInput';
import { TouchSlider } from './TouchSlider';

interface LivePatientSettingsModalProps {
  isOpen: boolean;
  currentPhysiology: PatientPhysiologySettings;
  currentTheme: ThemeName;
  onConfirm: (settings: PatientPhysiologySettings) => void;
  onClose: () => void;
}

interface EditingNumericInfo {
  path: string[]; // e.g., ['compliance']
  title: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
}

const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-md font-semibold text-gray-200 mt-3 mb-2 border-b border-gray-700 pb-1">{children}</h4>
);

const SettingsFieldDisplay: React.FC<{label: string, value: string | number | null | undefined, unit?: string, onEdit: () => void, themeColors: typeof THEME_CONFIG[ThemeName]}> =
    ({label, value, unit, onEdit, themeColors}) => (
    <div className="mb-2.5">
        <label className="block text-xs font-medium text-gray-400 mb-0.5">{label}</label>
        <button
            onClick={onEdit}
            className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-1 focus:ring-${themeColors.accent} focus:border-${themeColors.accent} outline-none text-sm text-left flex justify-between items-center h-9`}
        >
            <span>{value ?? '--'} {unit}</span>
            <span className="text-xs">✏️</span>
        </button>
    </div>
);

const inputBaseClasses = (themeColors: typeof THEME_CONFIG.anesthesia) =>
  `w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-1 focus:ring-${themeColors.accent} focus:border-${themeColors.accent} outline-none text-sm`;


export const LivePatientSettingsModal: React.FC<LivePatientSettingsModalProps> = ({ isOpen, currentPhysiology, currentTheme, onConfirm, onClose }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  const [settings, setSettings] = useState<PatientPhysiologySettings>(currentPhysiology);
  const [editingNumeric, setEditingNumeric] = useState<EditingNumericInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(currentPhysiology);
      setEditingNumeric(null);
    }
  }, [isOpen, currentPhysiology]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(settings);
  };

  const handlePresetChange = (presetKey: PresetKey | '') => {
    if (presetKey === '') {
        setSettings(prev => ({ ...prev, selectedPreset: null }));
    } else {
        const presetValues = PATIENT_PHYSIOLOGY_PRESETS_CONFIG[presetKey];
        setSettings(prev => ({
            ...prev,
            ...presetValues,
            selectedPreset: presetKey,
        }));
    }
  };

  const handleNumericEditConfirm = (valueStr: string) => {
    if (editingNumeric) {
      const { path, allowDecimal } = editingNumeric;
      const key = path[0] as keyof PatientPhysiologySettings;
      
      let finalValue: number = allowDecimal === false ? parseInt(valueStr, 10) : parseFloat(valueStr);
      if (isNaN(finalValue)) finalValue = editingNumeric.min ?? 0;

      setSettings(prev => ({
        ...prev,
        [key]: finalValue,
        selectedPreset: null, // Custom change clears preset
      }));
    }
    setEditingNumeric(null);
  };
  
  const handleWaveformFactorChange = (factorKey: keyof PatientPhysiologySettings, value: number) => {
    setSettings(prev => ({
      ...prev,
      [factorKey]: value,
      selectedPreset: null, // Custom change clears preset
    }));
  };

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border-2 border-${themeColors.border} flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-4 border-b border-gray-700`}>
            <h3 className={`text-xl font-semibold text-center text-${themeColors.accent}`}>{t.livePatientSettingsTitle}</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-grow">
          {editingNumeric ? (
            <TouchNumericInput
              initialValue={String(settings[editingNumeric.path[0] as keyof PatientPhysiologySettings] ?? editingNumeric.min ?? '0')}
              title={editingNumeric.title}
              unit={editingNumeric.unit || ''}
              min={editingNumeric.min}
              max={editingNumeric.max}
              step={editingNumeric.step}
              allowDecimal={editingNumeric.allowDecimal}
              showKeypad={false} // Use steppers for live adjustments
              themeColors={themeColors}
              onConfirm={handleNumericEditConfirm}
              onClose={() => setEditingNumeric(null)}
            />
          ) : (
            <div className="space-y-3">
              <SubHeading>{t.patientProfileSettings_subheading_physiology}</SubHeading>
              <div className="mb-2.5">
                  <label htmlFor="patientPreset" className="block text-xs font-medium text-gray-400 mb-0.5">{t.ventilationSettings_presetsLabel}</label>
                  <select id="patientPreset" value={settings.selectedPreset || ''} onChange={(e) => handlePresetChange(e.target.value as PresetKey | '')} className={`${inputBaseClasses(themeColors)} h-9`}>
                      <option value="">{t.preset_selectPrompt}</option>
                      {(Object.keys(PATIENT_PHYSIOLOGY_PRESETS_CONFIG) as PresetKey[]).map(key => (
                          <option key={key} value={key}>{t[`preset_${key}`]}</option>
                      ))}
                  </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <SettingsFieldDisplay label={t.ventilationSettings_spontaneousRateLabel} value={settings.spontaneousRate} unit="bpm" onEdit={() => setEditingNumeric({path:['spontaneousRate'], title:t.ventilationSettings_spontaneousRateLabel, unit:"bpm", min:0, max:60, step:1, allowDecimal:false})} themeColors={themeColors} />
                  <SettingsFieldDisplay label={t.ventilationSettings_complianceLabel} value={settings.compliance} unit="ml/cmH₂O" onEdit={() => setEditingNumeric({path:['compliance'], title:t.ventilationSettings_complianceLabel, unit:"ml/cmH₂O", min:1, max:150, step:1, allowDecimal:false})} themeColors={themeColors} />
                  <SettingsFieldDisplay label={t.ventilationSettings_resistanceLabel} value={settings.resistance} unit="cmH₂O/L/s" onEdit={() => setEditingNumeric({path:['resistance'], title:t.ventilationSettings_resistanceLabel, unit:"cmH₂O/L/s", min:1, max:50, step:1, allowDecimal:false})} themeColors={themeColors} />
              </div>
              
              <SubHeading>{t.patientProfileSettings_subheading_waveformFactors}</SubHeading>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                 <TouchSlider
                     label={t.simulatorSettings_inspiratoryEffortStrengthLabel}
                     min={0} max={1} step={0.1} initialValue={settings.inspiratoryEffortStrength ?? 0} unit=""
                     themeColors={themeColors}
                     onChange={(val) => handleWaveformFactorChange('inspiratoryEffortStrength', val)}
                 />
                 <TouchSlider
                     label={t.simulatorSettings_secretionsFactorLabel}
                     min={0} max={1} step={0.1} initialValue={settings.secretionsFactor ?? 0} unit=""
                     themeColors={themeColors}
                     onChange={(val) => handleWaveformFactorChange('secretionsFactor', val)}
                 />
                 <TouchSlider
                     label={t.simulatorSettings_expiratoryFlowLimitationFactorLabel}
                     min={0} max={1} step={0.1} initialValue={settings.expiratoryFlowLimitationFactor ?? 0} unit=""
                     themeColors={themeColors}
                     onChange={(val) => handleWaveformFactorChange('expiratoryFlowLimitationFactor', val)}
                 />
                 <TouchSlider
                     label={t.simulatorSettings_expiratoryEffortFactorLabel}
                     min={0} max={1} step={0.1} initialValue={settings.expiratoryEffortFactor ?? 0} unit=""
                     themeColors={themeColors}
                     onChange={(val) => handleWaveformFactorChange('expiratoryEffortFactor', val)}
                 />
             </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800/80 flex justify-end gap-3">
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
               {t.modalConfirm}
           </button>
        </div>
      </div>
    </div>
  );
};
