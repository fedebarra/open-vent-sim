import React, { useState, useEffect } from 'react';
import { PatientSettings, PatientGender, ThemeName } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path
import { THEME_CONFIG } from '../constants';
import { TranslationKeys } from '../src/i18n/locales';
import { TouchNumericInput } from './TouchNumericInput'; // Import the new component

interface PatientSettingsModalProps {
  isOpen: boolean;
  currentSettings: PatientSettings;
  currentTheme: ThemeName;
  onConfirm: (settings: PatientSettings) => void;
  onClose: () => void;
  overrideTitle?: TranslationKeys; 
}

interface EditableNumericFieldProps {
    label: string;
    value: string | null;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    allowDecimal?: boolean;
    themeColors: typeof THEME_CONFIG[ThemeName];
    onEdit: () => void;
}

const EditableDisplayField: React.FC<EditableNumericFieldProps> = ({ label, value, unit, themeColors, onEdit }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <button
            onClick={onEdit}
            className={`w-full p-2.5 bg-gray-700 border-2 ${themeColors.border} text-white rounded-md focus:ring-2 focus:${themeColors.ring} focus:${themeColors.border} outline-none text-left text-lg flex justify-between items-center`}
        >
            <span>{value || '--'} {unit}</span>
            <span className="text-xs">✏️</span>
        </button>
    </div>
);


export const PatientSettingsModal: React.FC<PatientSettingsModalProps> = ({ isOpen, currentSettings, currentTheme, onConfirm, onClose, overrideTitle }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  const [age, setAge] = useState<string | null>(currentSettings.age?.toString() || null);
  const [gender, setGender] = useState<PatientGender | ''>(currentSettings.gender || '');
  const [weight, setWeight] = useState<string | null>(currentSettings.weight?.toString() || null);

  const [editingField, setEditingField] = useState<'age' | 'weight' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAge(currentSettings.age?.toString() || null);
      setGender(currentSettings.gender || '');
      setWeight(currentSettings.weight?.toString() || null);
      setEditingField(null);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      age: age ? parseInt(age, 10) : null,
      gender: gender || null,
      weight: weight ? parseFloat(weight) : null,
    });
  };

  const handleNumericConfirm = (field: 'age' | 'weight', value: string) => {
    if (field === 'age') setAge(value);
    if (field === 'weight') setWeight(value);
    setEditingField(null);
  };
  
  const inputBaseClasses = `w-full p-2.5 bg-gray-700 border-2 ${themeColors.border} text-white rounded-md focus:ring-2 focus:${themeColors.ring} focus:${themeColors.border} outline-none text-lg`;
  const modalTitle = overrideTitle ? t[overrideTitle] : t.patientSettingsTitle;

  if (editingField) {
    return (
        <TouchNumericInput
            initialValue={editingField === 'age' ? age || '0' : weight || '0'}
            title={`${t.modalEditTitlePrefix}${editingField === 'age' ? t.patientAgeLabel : t.patientWeightLabel}`}
            unit={editingField === 'weight' ? 'kg' : ''}
            min={editingField === 'age' ? 0 : 0.1}
            max={editingField === 'age' ? 120 : 300}
            step={editingField === 'age' ? 1 : 0.1}
            allowDecimal={editingField === 'weight'}
            themeColors={themeColors}
            onConfirm={(val) => handleNumericConfirm(editingField, val)}
            onClose={() => setEditingField(null)}
        />
    );
  }

  return (
    <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 transition-opacity duration-300"
        onClick={onClose}
    >
      <div 
        className={`bg-gray-800 p-6 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-sm`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-xl font-semibold text-${themeColors.accent} mb-6 text-center`}>{modalTitle}</h3>
        
        <EditableDisplayField
            label={t.patientAgeLabel}
            value={age}
            themeColors={themeColors}
            onEdit={() => setEditingField('age')}
        />
        
        <div className="mb-4">
          <label htmlFor="patientGender" className="block text-sm font-medium text-gray-300 mb-1">{t.patientGenderLabel}</label>
          <select
            id="patientGender"
            value={gender}
            onChange={(e) => setGender(e.target.value as PatientGender)}
            className={inputBaseClasses}
          >
            <option value="" disabled>{t.modalEditTitlePrefix}...</option> 
            <option value={PatientGender.MALE}>{t.genderMale}</option>
            <option value={PatientGender.FEMALE}>{t.genderFemale}</option>
            <option value={PatientGender.OTHER}>{t.genderOther}</option>
          </select>
        </div>

        <EditableDisplayField
            label={t.patientWeightLabel}
            value={weight}
            unit="kg"
            themeColors={themeColors}
            onEdit={() => setEditingField('weight')}
        />

        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={handleConfirm}
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
