
import { GasConfig, VentModeConfig, AnestheticGasType, VentilationMode, ParameterKey, ParameterSettings, PatientSettings, PatientGender, AlarmSettings, AlarmParameterKey, AlarmLimits, OperatingMode, ICUSubMode, HumidifierSettings, AgentLevels, ThemeColors, ThemeName, SelfTestItem, PostScreenKey, PostScreenConfig, SimulatorSettings, PatientPhysiologyPresetKey, DefaultAnestheticAgentSetting, DefaultSelfTestSetting, PatientPhysiologySettings, HighFlowInterfaceType, HighFlowSpecificSettings, LastDisinfectionStatus, AllParameters, SweepSpeedOption, SweepSpeedValue, VentilatorData } from './types';
import { TranslationKeys } from './src/i18n/locales'; // Corrected path

export const GAS_CONFIG: Record<AnestheticGasType, Omit<GasConfig, 'name'> & { nameKey: TranslationKeys, label: string }> = {
  [AnestheticGasType.ISOFLURANE]: { nameKey: 'gas_isoflurane_name', color: '#9b59b6', mac: 1.15, label: 'ISO' }, // Standard MAC values
  [AnestheticGasType.SEVOFLURANE]: { nameKey: 'gas_sevoflurane_name', color: '#ffc107', mac: 2.0, label: 'SEVO' },
  [AnestheticGasType.DESFLURANE]: { nameKey: 'gas_desflurane_name', color: '#2196f3', mac: 6.0, label: 'DES' },
  [AnestheticGasType.N2O]: { nameKey: 'gas_n2o_name', color: '#9e9e9e', mac: 104, label: 'N₂O' }, // Note: N2O MAC is very high, usually used as adjunct
};

// Order for UI display
export const ANESTHETIC_GAS_ORDER: AnestheticGasType[] = [
  AnestheticGasType.SEVOFLURANE,
  AnestheticGasType.DESFLURANE,
  AnestheticGasType.ISOFLURANE,
  AnestheticGasType.N2O,
];


export const VENT_MODES_CONFIG: Record<VentilationMode, Omit<VentModeConfig, 'name'> & { nameKey: TranslationKeys, acronymKey: TranslationKeys, color: string, textColor?: string }> = {
  [VentilationMode.VC]: { nameKey: 'mode_vc_name', acronymKey: 'mode_vcv_acronym', color: '#4caf50' },
  [VentilationMode.PC]: { nameKey: 'mode_pc_name', acronymKey: 'mode_pcv_acronym', color: '#ff9800' },
  [VentilationMode.PS]: { nameKey: 'mode_ps_name', acronymKey: 'mode_psv_acronym', color: '#2196f3' }, 
  [VentilationMode.SIMV]: { nameKey: 'mode_simv_name', acronymKey: 'mode_simv_acronym', color: '#9c27b0' },
  [VentilationMode.CPAP]: { nameKey: 'mode_cpap_name', acronymKey: 'mode_cpap_acronym', color: '#00bcd4' },
  [VentilationMode.HIGH_FLOW]: { nameKey: 'mode_high_flow_name', acronymKey: 'mode_high_flow_name', color: '#ffeb3b', textColor: '#000000' }, // High flow uses full name as acronym effectively
};

export const AMBIENT_TEMPERATURE = 22; // Celsius
export const HIGH_FLOW_ADULT_FGF_MIN = 10;
export const HIGH_FLOW_ADULT_FGF_MAX = 60;
export const HIGH_FLOW_PEDIATRIC_FGF_MIN = 2; // Junior mode will use this as "pediatric/junior"
export const HIGH_FLOW_PEDIATRIC_FGF_MAX = 25; // Junior mode will use this
export const HIGH_FLOW_FGF_ADULT_TRANSITION_POINT = 25;
export const HIGH_FLOW_FGF_STEP_LOW = 1;
export const HIGH_FLOW_FGF_STEP_HIGH = 5;

export const HIGH_FLOW_TEMP_VALUES_ADULT = [31, 34, 37]; // °C
export const HIGH_FLOW_TEMP_VALUES_JUNIOR = [31, 34]; // °C
export const HIGH_FLOW_TEMP_DEFAULT_ADULT = 37; // °C
export const HIGH_FLOW_TEMP_DEFAULT_JUNIOR = 34; // °C
export const HIGH_FLOW_TEMP_MIN = 31;
export const HIGH_FLOW_TEMP_MAX_ADULT = 37;
export const HIGH_FLOW_TEMP_MAX_JUNIOR = 34;
export const HIGH_FLOW_TEMP_STEP = 3; // Allows 31, 34, 37


export const INITIAL_PARAMETERS: AllParameters = {
  volume: 500,
  pressureTarget: 18,
  frequency: 12,
  peep: 5,
  fio2: 40,
  ratio: "1:2",
  psLevel: 10,
  triggerFlow: 2,
  pPeak: 18,
  pPlateau: 15,
  pMean: 8,
  compliance: 50,
  resistance: 10,
  spontaneousRate: 14,
  fgf: 2, // Default FGF, will be adjusted post-interface selection for High Flow
  volumeMinute: 6.0,
  volumeInspired: 500,
  volumeExpired: 495,
  etco2: 35,
  spo2: 98,
  heartRate: 72,
  bloodPressure: "120/80",
  temperature: HIGH_FLOW_TEMP_DEFAULT_ADULT, // Default target circuit temp for HF, general humidifier setting
  deliveredTemperature: AMBIENT_TEMPERATURE, // Monitored delivered gas temperature for HF
  mlPerKg: 0,
  humidifierTemperature: 37, // Default general humidifier setting temp
  tiTtot: 0.33,
  leakPercentage: 0,
  measuredFrequency: 12,
  inspiratoryPausePercent: 10,
  inspiratoryRiseTimeSeconds: 0.15,
  flowCycleOffPercent: 25,
  backupPressure: 15,
  backupFrequency: 12,
  backupIERatio: "1:2.0",
  inspiratoryCo2: 0,
  targetMac: 1.0,
  etAgentConcentration: 0,
  etSecondaryAgentConcentration: 0,
  fiAgentConcentration: 0,
  fiSecondaryAgentConcentration: 0,
  targetEtPrimaryAgent: 0,
  targetEtSecondaryAgent: 0,
  agentRemainingPercent: 100,
  sodaLimeRemainingPercent: 0,
  isMechanicalVentilation: 0,
  waterLevelPercent: 100,
  highFlowInterfaceType: 'adult', // Default to adult
  lastDisinfectionStatus: 'clean' as LastDisinfectionStatus,
  // New physiological factors for waveform modeling
  expiratoryEffortFactor: 0,
  inspiratoryEffortStrength: 0.7,
  expiratoryFlowLimitationFactor: 0,
  secretionsFactor: 0,
};

export const INITIAL_AGENT_LEVELS: AgentLevels = {
  [AnestheticGasType.SEVOFLURANE]: 100,
  [AnestheticGasType.DESFLURANE]: 100,
  [AnestheticGasType.ISOFLURANE]: 100,
  [AnestheticGasType.N2O]: 100,
};


export const PARAMETER_DEFINITIONS: Record<ParameterKey, ParameterSettings> = {
  volume: { labelKey: 'param_volume_label', unitKey: 'unit_ml', isLarge: true, displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && mode === VentilationMode.VC && !!isMechVent) || (opMode === 'icu' && icuSubMode === 'invasive' && (mode === VentilationMode.VC || mode === VentilationMode.SIMV))), isEditable: true, min: 50, max: 1500, step: 10 },
  pressureTarget: { labelKey: 'param_pressureTarget_label', unitKey: 'unit_cmH2O', isLarge: true, displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && mode === VentilationMode.PC && !!isMechVent) || (opMode === 'icu' && icuSubMode === 'invasive' && (mode === VentilationMode.PC || mode === VentilationMode.SIMV))), isEditable: true, min: 5, max: 40, step: 1 },
  frequency: { labelKey: 'param_frequency_label', unitKey: 'unit_per_min', isLarge: true, isEditable: true, min: 4, max: 60, step: 1, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && icuSubMode !== 'high-flow' && mode !== VentilationMode.CPAP) },
  peep: { labelKey: 'param_peep_label', unitKey: 'unit_cmH2O', isEditable: true, min: 0, max: 30, step: 1, valueFormatter: (val) => `+${val}`, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia') || (opMode === 'icu' && !(icuSubMode === 'high-flow')) },
  fio2: { labelKey: 'param_fio2_label', unitKey: 'unit_percent', isEditable: true, min: 21, max: 100, step: 5, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' || opMode === 'icu' },
  ratio: { labelKey: 'param_ratio_label', unitKey: 'unit_none' , displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && (mode === VentilationMode.VC || mode === VentilationMode.PC) && !!isMechVent) || (opMode === 'icu' && icuSubMode === 'invasive' && (mode === VentilationMode.VC || mode === VentilationMode.PC || mode === VentilationMode.SIMV))), isEditable: true },
  psLevel: { labelKey: 'param_psLevel_label', unitKey: 'unit_cmH2O', displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && mode === VentilationMode.PS && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && (mode === VentilationMode.PS || mode === VentilationMode.SIMV))), isEditable: true, min: 0, max: 40, step: 1, valueFormatter: (val) => `+${val}` },
  triggerFlow: { labelKey: 'param_triggerFlow_label', unitKey: 'unit_L_min',
    displayCondition: (mode, opMode, icuSubMode, isMechVent) =>
      (opMode === 'anesthesia' && mode === VentilationMode.PS && !!isMechVent) ||
      (opMode === 'icu' && (
        (icuSubMode === 'invasive' && (mode === VentilationMode.PS || mode === VentilationMode.SIMV || mode === VentilationMode.VC || mode === VentilationMode.PC)) ||
        (icuSubMode === 'non-invasive' && mode === VentilationMode.PS)
      )),
    isEditable: true, min: 0.5, max: 10, step: 0.1
  },

  inspiratoryPausePercent: { 
    labelKey: 'param_inspiratoryPausePercent_label', 
    unitKey: 'unit_percent', 
    displayCondition: (mode, opMode, icuSubMode, isMechVent) => 
      ((opMode === 'icu' && icuSubMode === 'invasive' && (mode === VentilationMode.VC || mode === VentilationMode.SIMV)) || 
      (opMode === 'anesthesia' && !!isMechVent && (mode === VentilationMode.VC || mode === VentilationMode.SIMV))), 
    isEditable: true, 
    min: 0, 
    max: 30, 
    step: 1 
  },
  inspiratoryRiseTimeSeconds: { labelKey: 'param_inspiratoryRiseTimeSeconds_label', unitKey: 'unit_seconds',
    displayCondition: (mode, opMode, icuSubMode) =>
      (opMode === 'icu' && (
        (icuSubMode === 'invasive' && (mode === VentilationMode.PC || mode === VentilationMode.PS || mode === VentilationMode.SIMV)) ||
        (icuSubMode === 'non-invasive' && mode === VentilationMode.PS)
      )),
    isEditable: true, min: 0, max: 0.4, step: 0.05
  },
  flowCycleOffPercent: { labelKey: 'param_flowCycleOffPercent_label', unitKey: 'unit_percent',
    displayCondition: (mode, opMode, icuSubMode) =>
      (opMode === 'icu' && (
        (icuSubMode === 'invasive' && (mode === VentilationMode.PS || mode === VentilationMode.SIMV)) ||
        (icuSubMode === 'non-invasive' && mode === VentilationMode.PS)
      )),
    isEditable: true, min: 5, max: 70, step: 5
  },
  backupPressure: { labelKey: 'param_backupPressure_label', unitKey: 'unit_cmH2O',
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && (mode === VentilationMode.PS || mode === VentilationMode.CPAP),
    isEditable: true, min: 5, max: 40, step: 1
  },
  backupFrequency: { labelKey: 'param_backupFrequency_label', unitKey: 'unit_per_min',
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && (mode === VentilationMode.PS || mode === VentilationMode.CPAP),
    isEditable: true, min: 5, max: 30, step: 1
  },
  backupIERatio: { labelKey: 'param_backupIERatio_label', unitKey: 'unit_none',
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && (mode === VentilationMode.PS || mode === VentilationMode.CPAP),
    isEditable: true
  },

  pPeak: { labelKey: 'param_pPeak_label', unitKey: 'unit_cmH2O', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP) },
  pPlateau: { labelKey: 'param_pPlateau_label', unitKey: 'unit_cmH2O', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP && mode !== VentilationMode.PS && !!isMechVent) || (opMode === 'icu' && icuSubMode==='invasive' && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP && mode !== VentilationMode.PS))},
  pMean: { labelKey: 'param_pMean_label', unitKey: 'unit_cmH2O', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP) },
  measuredFrequency: { labelKey: 'param_measuredFrequency_label', unitKey: 'unit_per_min', isEditable: false,
    displayCondition: (mode, opMode, icuSubMode, isMechVent) =>
      (opMode === 'anesthesia' && !!isMechVent) ||
      (opMode === 'icu' && (icuSubMode === 'invasive' || (icuSubMode === 'non-invasive' && mode === VentilationMode.PS)) && mode !== VentilationMode.HIGH_FLOW )
  },
  compliance: { labelKey: 'param_compliance_label', unitKey: 'unit_ml_cmH2O', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && icuSubMode === 'invasive' ) },
  resistance: { labelKey: 'param_resistance_label', unitKey: 'unit_cmH2O_L_s', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && icuSubMode === 'invasive' ) },
  spontaneousRate: { labelKey: 'ventilationSettings_spontaneousRateLabel', unitKey: 'unit_per_min', isEditable: false, displayCondition: () => false }, // Not directly displayed/editable in main UI, set via settings

  fgf: { labelKey: 'param_fgf_label', unitKey: 'unit_L_min', isEditable: true, min: HIGH_FLOW_PEDIATRIC_FGF_MIN, max: HIGH_FLOW_ADULT_FGF_MAX, // Widest range
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'anesthesia' || (opMode === 'icu' && icuSubMode === 'high-flow'),
    dynamicStep: (currentValue: number, hfInterface?: HighFlowInterfaceType | null) => {
        if (hfInterface === 'adult') {
            return currentValue >= HIGH_FLOW_FGF_ADULT_TRANSITION_POINT ? HIGH_FLOW_FGF_STEP_HIGH : HIGH_FLOW_FGF_STEP_LOW;
        }
        // For 'pediatric'/'junior' or anesthesia
        return HIGH_FLOW_FGF_STEP_LOW;
    }
  },
  volumeMinute: { labelKey: 'param_volumeMinute_label', unitKey: 'unit_L_min_long', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP) },
  volumeInspired: { labelKey: 'param_volumeInspired_label', unitKey: 'unit_ml', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP) },
  volumeExpired: { labelKey: 'param_volumeExpired_label', unitKey: 'unit_ml', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => (opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP) },
  mlPerKg: { labelKey: 'param_mlPerKg_label', unitKey: 'unit_ml_kg', isEditable: false, isCalculated: true, displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive'))) && mode !== VentilationMode.HIGH_FLOW && mode !== VentilationMode.CPAP },
  tiTtot: { labelKey: 'param_tiTtot_label', unitKey: 'unit_none', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => ((opMode === 'anesthesia' && !!isMechVent) || (opMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive'))) && ![VentilationMode.CPAP, VentilationMode.HIGH_FLOW].includes(mode) },
  leakPercentage: {
    labelKey: 'param_leakPercentage_label',
    unitKey: 'unit_percent',
    isEditable: false,
    displayCondition: (mode, opMode, icuSubMode) =>
      (opMode === 'icu' && icuSubMode === 'non-invasive') &&
      mode !== VentilationMode.HIGH_FLOW
  },

  etco2: { labelKey: 'param_etco2_label', unitKey: 'unit_mmHg', isEditable: false, displayCondition: (mode, opMode) => opMode === 'anesthesia' },
  spo2: { labelKey: 'param_spo2_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode) => opMode === 'anesthesia' },

  humidifierTemperature: { labelKey: 'param_humidifierTemperature_label', unitKey: 'unit_celsius', isEditable: true, min: 31, max: 39, step: 1, displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode !== 'high-flow' }, // Not for HF LeftPanel

  heartRate: { labelKey: 'param_heartRate_label', unitKey: 'unit_bpm', isEditable: false, displayCondition: () => false },
  bloodPressure: { labelKey: 'param_bloodPressure_label', unitKey: 'unit_mmHg', isEditable: false, displayCondition: () => false },
  temperature: { labelKey: 'param_temperature_label', unitKey: 'unit_celsius', isEditable: true, // This is HF Target Temp Setting
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow',
    min: HIGH_FLOW_TEMP_MIN, max: HIGH_FLOW_TEMP_MAX_ADULT, step: HIGH_FLOW_TEMP_STEP // Widest range, modal will adjust for junior
  },
  deliveredTemperature: { labelKey: 'param_deliveredTemperature_label', unitKey: 'unit_celsius', isEditable: false, // This is HF Monitored Delivered Temp
    displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow'
  },
  inspiratoryCo2: { labelKey: 'param_inspiratoryCo2_label', unitKey: 'unit_mmHg', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' && !!isMechVent },
  targetMac: { labelKey: 'param_targetMac_label', unitKey: 'unit_mac', isEditable: true, min:0.1, max: 3.0, step: 0.1, displayCondition: (mode, opMode) => opMode === 'anesthesia'},
  targetEtPrimaryAgent: { labelKey: 'param_targetEtAgent_label', unitKey: 'unit_percent', isEditable: true, min: 0, max: 20, step: 0.1, displayCondition: (mode, opMode) => opMode === 'anesthesia'},
  targetEtSecondaryAgent: { labelKey: 'param_targetEtAgent_label', unitKey: 'unit_percent', isEditable: true, min: 0, max: 20, step: 0.1, displayCondition: (mode, opMode) => opMode === 'anesthesia'},
  etAgentConcentration: { labelKey: 'param_etAgentConcentration_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' && !!isMechVent },
  etSecondaryAgentConcentration: { labelKey: 'param_etSecondaryAgentConcentration_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' && !!isMechVent },
  fiAgentConcentration: { labelKey: 'param_fiAgentConcentration_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' && !!isMechVent },
  fiSecondaryAgentConcentration: { labelKey: 'param_fiAgentConcentration_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode, icuSubMode, isMechVent) => opMode === 'anesthesia' && !!isMechVent },
  waterLevelPercent: { labelKey: 'param_waterLevel_label', unitKey: 'unit_percent', isEditable: false, displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' },
  lastDisinfectionStatus: { labelKey: 'lastDisinfectionStatusLabel', unitKey: 'unit_none', isEditable: false, displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' },
  highFlowInterfaceType: { labelKey: 'hfInterfaceTypeLabel', unitKey: 'unit_none', isEditable: false, displayCondition: (mode, opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' }, // Not typically editable, shown for info
  // New physiological factors (not directly displayed/editable in main UI, set via settings)
  expiratoryEffortFactor: { labelKey: 'param_expiratoryEffortFactor_label' as TranslationKeys, unitKey: 'unit_none', isEditable: false, displayCondition: () => false },
  inspiratoryEffortStrength: { labelKey: 'param_inspiratoryEffortStrength_label' as TranslationKeys, unitKey: 'unit_none', isEditable: false, displayCondition: () => false },
  expiratoryFlowLimitationFactor: { labelKey: 'param_expiratoryFlowLimitationFactor_label' as TranslationKeys, unitKey: 'unit_none', isEditable: false, displayCondition: () => false },
  secretionsFactor: { labelKey: 'param_secretionsFactor_label' as TranslationKeys, unitKey: 'unit_none', isEditable: false, displayCondition: () => false },
};

export const INITIAL_PATIENT_SETTINGS: PatientSettings = {
  age: 35,
  gender: PatientGender.MALE,
  weight: 70,
};

export const INITIAL_ALARM_SETTINGS: AlarmSettings = {
  pPeak: { low: 10, high: 40, isOn: true },
  volumeMinute: { low: 2.0, high: 15.0, isOn: true },
  etco2: { low: 25, high: 50, isOn: true },
  fio2: { low: 21, high: 99, isOn: true },
  peep: { low: 0, high: 20, isOn: true },
  deliveredFlow: { low: 5, high: 70, isOn: true }, // Max range, will be narrowed by interface
  frequency: { low: 5, high: 35, isOn: true },
  measuredFrequency: { low: 5, high: 35, isOn: true },
  leakPercentage: { low: null, high: 30, isOn: true },
  inspiratoryCo2: { low: null, high: 5, isOn: true },
  etAgentConcentration: { low: 0.1, high: 5.0, isOn: true },
  checkWater: { low: null, high: null, isOn: true},
  cannotReachTargetFlow: { low: 5, high: null, isOn: true}, // Low only, value is deviation from target
  checkTube: { low: null, high: null, isOn: true },
};

export const INITIAL_HUMIDIFIER_SETTINGS: HumidifierSettings = {
  isOn: false,
  temperature: 37,
};


export const ALARMABLE_PARAMETERS_CONFIG: Record<AlarmParameterKey, {
  labelKey: TranslationKeys;
  unitKey: TranslationKeys;
  stepLow: number;
  stepHigh: number;
  minLow?: number; // Base minimum for low limit slider
  maxLow?: number; // Base maximum for low limit slider
  minHigh?: number; // Base minimum for high limit slider
  maxHigh?: number; // Base maximum for high limit slider
  isLowOnly?: boolean;
  isHighOnly?: boolean;
  displayCondition?: (opMode?: OperatingMode, icuSubMode?: ICUSubMode) => boolean;
  isHighOnlyDisplayCondition?: (opMode?: OperatingMode, icuSubMode?: ICUSubMode) => boolean;
  isToggleOnly?: boolean; // For alarms like Check Water
}> = {
  pPeak: { labelKey: 'alarm_pPeak_label', unitKey: 'unit_cmH2O', stepLow: 1, stepHigh: 1, minLow: 0, maxLow: 60, minHigh: 1, maxHigh: 70, displayCondition: (opMode, icuSubMode) => !(opMode === 'icu' && icuSubMode === 'high-flow') },
  volumeMinute: { labelKey: 'alarm_volumeMinute_label', unitKey: 'unit_L_min_long', stepLow: 0.1, stepHigh: 0.1, minLow: 0.1, maxLow: 20, minHigh: 0.2, maxHigh: 30, displayCondition: (opMode, icuSubMode) => !(opMode === 'icu' && icuSubMode === 'high-flow') },
  etco2: { labelKey: 'alarm_etco2_label', unitKey: 'unit_mmHg', stepLow: 1, stepHigh: 1, minLow: 10, maxLow: 70, minHigh: 15, maxHigh: 80, displayCondition: (opMode) => opMode === 'anesthesia' },
  fio2: { labelKey: 'alarm_fio2_label', unitKey: 'unit_percent', stepLow: 1, stepHigh: 1, minLow: 18, maxLow: 99, minHigh: 22, maxHigh: 100, isHighOnlyDisplayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow', displayCondition: (opMode, icuSubMode) => opMode === 'anesthesia' || (opMode === 'icu' && icuSubMode !== 'high-flow') },
  peep: { labelKey: 'alarm_peep_label', unitKey: 'unit_cmH2O', stepLow: 1, stepHigh: 1, minLow: 0, maxLow: 25, minHigh: 1, maxHigh: 30, displayCondition: (opMode, icuSubMode) => !(opMode === 'icu' && icuSubMode === 'high-flow') },
  deliveredFlow: { labelKey: 'alarm_deliveredFlow_label', unitKey: 'unit_L_min', stepLow: 1, stepHigh: 1, minLow: 1, maxLow: 55, minHigh: 3, maxHigh: 70, displayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' }, // Base wide range, modal will narrow
  frequency: { labelKey: 'alarm_frequency_label', unitKey: 'unit_per_min', stepLow: 1, stepHigh: 1, minLow: 2, maxLow: 50, minHigh: 3, maxHigh: 60, displayCondition: (opMode, icuSubMode) => !(opMode === 'icu' && icuSubMode === 'high-flow') },
  measuredFrequency: { labelKey: 'alarm_measuredFrequency_label', unitKey: 'unit_per_min', stepLow: 1, stepHigh: 1, minLow: 2, maxLow: 50, minHigh: 3, maxHigh: 60,
    displayCondition: (opMode, icuSubMode) => (opMode === 'anesthesia') || (opMode === 'icu' && (icuSubMode === 'invasive' || (icuSubMode === 'non-invasive' && (ALARMABLE_PARAMETERS_CONFIG.measuredFrequency as any)._mode === VentilationMode.PS)))
  },
  leakPercentage: { labelKey: 'alarm_leakPercentage_label', unitKey: 'unit_percent', stepLow: 0, stepHigh: 1, minLow: 0, maxLow: 99, minHigh: 1, maxHigh: 100, isHighOnly: true, displayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'non-invasive' },
  inspiratoryCo2: { labelKey: 'alarm_inspiratoryCo2_label', unitKey: 'unit_mmHg', stepLow: 0, stepHigh: 1, minLow: 0, maxLow: 15, minHigh: 1, maxHigh: 20, isHighOnly: true, displayCondition: (opMode) => opMode === 'anesthesia' },
  etAgentConcentration: { labelKey: 'alarm_etAgentConcentration_label', unitKey: 'unit_percent', stepLow: 0.1, stepHigh: 0.1, minLow: 0, maxLow: 10, minHigh: 0.1, maxHigh: 15, displayCondition: (opMode) => opMode === 'anesthesia' },
  checkWater: { labelKey: 'alarm_checkWater_label', unitKey: 'unit_none', stepLow: 0, stepHigh: 0, isToggleOnly: true, displayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' },
  cannotReachTargetFlow: { labelKey: 'alarm_cannotReachTargetFlow_label', unitKey: 'unit_L_min', stepLow: 1, stepHigh: 0, minLow: 1, maxLow: 20, isLowOnly: true, displayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow' },
  checkTube: { labelKey: 'alarm_checkTube_label', unitKey: 'unit_none', stepLow: 0, stepHigh: 0, isToggleOnly: true, displayCondition: (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow'},
};

export const WAVEFORM_CONFIGS: Record<'pressure' | 'volume' | 'flow', { titleKey: TranslationKeys; color: string }> = {
  pressure: { titleKey: 'graph_pressure_title', color: '#ffb300' }, // Yellow/Orange
  volume: { titleKey: 'graph_volume_title', color: '#00b0ff' },   // Light Blue
  flow: { titleKey: 'graph_flow_title', color: '#4caf50' },     // Green
};


export const THEME_CONFIG: Record<ThemeName, ThemeColors> = {
  anesthesia: {
    primary: 'teal-600',
    primaryDark: 'teal-700',
    primaryLight: 'teal-500',
    accent: 'teal-500',
    textOnPrimary: 'text-white',
    buttonGradientFrom: 'from-teal-700',
    buttonGradientTo: 'to-teal-600',
    border: 'border-teal-600',
    ring: 'ring-teal-500',
    graphColor1: '#ffb300',
    graphColor2: '#00b0ff',
    graphColor3: '#4caf50',
    modeButtonBg: '#14B8A6', 
    modeButtonText: 'text-white',
    selectedModeButtonBg: 'yellow-400', 
    selectedModeButtonText: 'text-black',
  },
  icu: {
    primary: 'sky-600',
    primaryDark: 'sky-700',
    primaryLight: 'sky-500',
    accent: 'sky-500',
    textOnPrimary: 'text-white',
    buttonGradientFrom: 'from-sky-700',
    buttonGradientTo: 'to-sky-600',
    border: 'border-sky-600',
    ring: 'ring-sky-500',
    graphColor1: '#ffb300',
    graphColor2: '#00b0ff',
    graphColor3: '#4caf50',
    modeButtonBg: '#03A9F4', 
    modeButtonText: 'text-white',
    selectedModeButtonBg: 'yellow-400', 
    selectedModeButtonText: 'text-black',
  },
  highFlow: { 
    primary: 'neutral-600', 
    primaryDark: 'neutral-700',
    primaryLight: 'neutral-500',
    accent: 'neutral-500', 
    textOnPrimary: 'text-white',
    buttonGradientFrom: 'from-neutral-700',
    buttonGradientTo: 'to-neutral-600',
    border: 'border-neutral-600',
    ring: 'ring-neutral-500',
    graphColor1: '#A0AEC0', // FGF Line: Gray 400 (Unchanged)
    graphColor2: '#00b0ff', // Volume (unused): Blue
    graphColor3: '#4caf50', // Flow (unused): Green
    modeButtonBg: '#718096', 
    modeButtonText: 'text-white',
    selectedModeButtonBg: 'gray-400', 
    selectedModeButtonText: 'text-black', 
  },
  nonInvasive: {
    primary: 'amber-600',
    primaryDark: 'amber-700',
    primaryLight: 'amber-500',
    accent: 'amber-500',
    textOnPrimary: 'text-black', 
    buttonGradientFrom: 'from-amber-600',
    buttonGradientTo: 'to-amber-700',
    border: 'border-amber-600',
    ring: 'ring-amber-500',
    graphColor1: '#ffb300',
    graphColor2: '#00b0ff',
    graphColor3: '#4caf50',
    modeButtonBg: '#F59E0B', 
    modeButtonText: 'text-black', 
    selectedModeButtonBg: 'sky-300', 
    selectedModeButtonText: 'text-black',
  }
};

ALARMABLE_PARAMETERS_CONFIG.fio2.isHighOnlyDisplayCondition = (opMode, icuSubMode) => opMode === 'icu' && icuSubMode === 'high-flow';
ALARMABLE_PARAMETERS_CONFIG.etco2.displayCondition = (opMode) => opMode === 'anesthesia';
ALARMABLE_PARAMETERS_CONFIG.measuredFrequency.displayCondition = (opMode, icuSubMode) => (opMode === 'anesthesia') || (opMode === 'icu' && (icuSubMode === 'invasive' || (icuSubMode === 'non-invasive' && (ALARMABLE_PARAMETERS_CONFIG.measuredFrequency as any)._mode === VentilationMode.PS)));


if (ALARMABLE_PARAMETERS_CONFIG.leakPercentage) {
    ALARMABLE_PARAMETERS_CONFIG.leakPercentage.displayCondition = (opMode, icuSubMode) =>
        opMode === 'icu' && icuSubMode === 'non-invasive';
}
if (ALARMABLE_PARAMETERS_CONFIG.inspiratoryCo2) {
    ALARMABLE_PARAMETERS_CONFIG.inspiratoryCo2.displayCondition = (opMode) => opMode === 'anesthesia';
}
if (ALARMABLE_PARAMETERS_CONFIG.etAgentConcentration) {
    ALARMABLE_PARAMETERS_CONFIG.etAgentConcentration.displayCondition = (opMode) => opMode === 'anesthesia';
}


export const MANEUVER_HOLD_DURATION_MS = 2000;

export const MANEUVER_UNIT_CMH2O: TranslationKeys = 'unit_cmH2O';
export const MANEUVER_UNIT_ML_CMH2O: TranslationKeys = 'unit_ml_cmH2O';
export const MANEUVER_UNIT_CMH2O_L_S: TranslationKeys = 'unit_cmH2O_L_s';
export const MANEUVER_UNIT_CMH2O_L: TranslationKeys = 'unit_cmH2O_L';
export const MANEUVER_UNIT_ML: TranslationKeys = 'unit_ml';
export const MANEUVER_UNIT_NONE: TranslationKeys = 'unit_none';

export const AGENT_CONSUMPTION_REFERENCE_FGF_L_MIN = 10;
export const AGENT_CONSUMPTION_DURATION_SECONDS_AT_REF_FGF = 3600;

export const SODA_LIME_MAX_LIFETIME_HOURS_HIGH_FGF = 8;
export const SODA_LIME_MIN_LIFETIME_HOURS_LOW_FGF = 2;
export const SODA_LIME_FGF_HIGH_THRESHOLD_L_MIN = 6;
export const SODA_LIME_FGF_LOW_THRESHOLD_L_MIN = 0.5;

export const ET_AGENT_TIME_CONSTANT_FACTOR = 0.05;
export const ET_AGENT_MIN_FGF_EFFECT = 0.5;

export const O2_FLUSH_DURATION_MS = 30000;
export const SNOOZE_DURATION_MS = 120000; // 2 minutes for alarm snooze

export const DEFAULT_SELF_TEST_ITEMS: Omit<SelfTestItem, 'status'>[] = [
  { nameKey: 'selfTest_item_cpu' },
  { nameKey: 'selfTest_item_memory' },
  { nameKey: 'selfTest_item_display' },
  { nameKey: 'selfTest_item_battery' },
  { nameKey: 'selfTest_item_flowSensor' },
  { nameKey: 'selfTest_item_pressureSensor' },
  { nameKey: 'selfTest_item_o2Sensor' },
  { nameKey: 'selfTest_item_valves' },
  { nameKey: 'selfTest_item_alarms' },
  { nameKey: 'selfTest_item_circuitLeak' },
];

export const ANESTHESIA_POST_SELF_TEST_ITEMS: Omit<SelfTestItem, 'status'>[] = [
  { nameKey: 'selfTest_an_internal_tests' },
  { nameKey: 'selfTest_an_barometer' },
  { nameKey: 'selfTest_an_gas_supply_pressure' },
  { nameKey: 'selfTest_an_pressure_transducers' },
  { nameKey: 'selfTest_an_safety_valve' },
  { nameKey: 'selfTest_an_vaporizer_inlet_outlet_valve' },
  { nameKey: 'selfTest_an_flow_transducer' },
  { nameKey: 'selfTest_an_auto_vent_leakage' },
  { nameKey: 'selfTest_an_man_vent_leakage' },
  { nameKey: 'selfTest_an_gas_analyzer' },
  { nameKey: 'selfTest_an_battery' },
  { nameKey: 'selfTest_an_vaporizer_1' },
  { nameKey: 'selfTest_an_vaporizer_2' },
  { nameKey: 'selfTest_an_technical_alarms' },
];

export const VENTILATOR_POST_SELF_TEST_ITEMS: Omit<SelfTestItem, 'status'>[] = [
  { nameKey: 'selfTest_vent_internal_functionality' },
  { nameKey: 'selfTest_vent_gas_supply' },
  { nameKey: 'selfTest_vent_internal_leakage' },
  { nameKey: 'selfTest_vent_pressure_transducers' },
  { nameKey: 'selfTest_vent_safety_valve' },
  { nameKey: 'selfTest_vent_o2_sensor' },
  { nameKey: 'selfTest_vent_flow_transducers' },
  { nameKey: 'selfTest_vent_battery_modules' },
  { nameKey: 'selfTest_vent_patient_circuit_leakage' },
  { nameKey: 'selfTest_vent_patient_circuit_compliance' },
  { nameKey: 'selfTest_vent_patient_circuit_resistance' },
];

export const HIGH_FLOW_POST_SELF_TEST_ITEMS: Omit<SelfTestItem, 'status'>[] = [
  { nameKey: 'selfTest_item_cpu' },
  { nameKey: 'selfTest_item_display' },
  { nameKey: 'selfTest_item_flowSensor' },
  { nameKey: 'selfTest_item_o2Sensor'},
  { nameKey: 'selfTest_hf_heater_plate' },
  { nameKey: 'selfTest_hf_temp_sensor' },
  { nameKey: 'selfTest_hf_alarms' },
];


export const SELF_TEST_ITEM_DURATION_MS = 1000;

export const POST_SCREEN_CONFIG: Record<PostScreenKey, PostScreenConfig> = {
  anesthesia_post: {
    deviceTitleKey: 'anesthesiaMachinePowerOnTitle',
    theme: 'anesthesia',
    proceedsTo: 'patient_data',
    initialOperatingMode: 'anesthesia',
  },
  icu_general_post: {
    deviceTitleKey: 'ventilatorPowerOnTitle',
    theme: 'icu', // Base theme, will adjust in App.tsx based on sub-mode selection on this screen
    proceedsTo: 'icu_sub_selection', // This will lead to selecting Invasive/Non-Invasive and then their specific POST/interface
    initialOperatingMode: 'icu',
  },
  high_flow_post: {
    deviceTitleKey: 'highFlowOxygenatorPowerOnTitle',
    theme: 'highFlow',
    proceedsTo: 'patient_data', // Will now lead to patient data after interface selection within PostScreen
    initialOperatingMode: 'icu',
    initialIcuSubMode: 'high-flow',
    initialHighFlowInterfaceType: 'adult', // Default interface type
    testItems: HIGH_FLOW_POST_SELF_TEST_ITEMS,
  },
  icu_invasive_post: {
    deviceTitleKey: 'ventilatorPowerOnTitle',
    theme: 'icu',
    proceedsTo: 'patient_data',
    initialOperatingMode: 'icu',
    initialIcuSubMode: 'invasive',
  },
  icu_noninvasive_post: {
    deviceTitleKey: 'ventilatorPowerOnTitle',
    theme: 'nonInvasive',
    proceedsTo: 'patient_data',
    initialOperatingMode: 'icu',
    initialIcuSubMode: 'non-invasive',
  },
};

// Patient Physiology Presets
export const PATIENT_PHYSIOLOGY_PRESETS_CONFIG: Record<PatientPhysiologyPresetKey, Omit<PatientPhysiologySettings, 'selectedPreset' | 'age' | 'gender' | 'weight'>> = {
  normal: { spontaneousRate: 14, compliance: 60, resistance: 8, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.7, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0 },
  copd: { spontaneousRate: 22, compliance: 70, resistance: 20, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.2, expiratoryFlowLimitationFactor: 0.7, secretionsFactor: 0.3 },
  ards: { spontaneousRate: 25, compliance: 30, resistance: 12, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.5, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0 },
  covid: { spontaneousRate: 28, compliance: 35, resistance: 10, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.6, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0 },
  anaphylaxis: { spontaneousRate: 28, compliance: 40, resistance: 25, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.7, expiratoryFlowLimitationFactor: 0.4, secretionsFactor: 0 },
  pulmonaryEdema: { spontaneousRate: 26, compliance: 30, resistance: 15, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.4, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0 },
  pneumonia: { spontaneousRate: 24, compliance: 35, resistance: 14, expiratoryEffortFactor: 0, inspiratoryEffortStrength: 0.3, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0.6 },
  fibroscopy: { spontaneousRate: 10, compliance: 40, resistance: 35, expiratoryEffortFactor: 0.5, inspiratoryEffortStrength: 0.8, expiratoryFlowLimitationFactor: 0, secretionsFactor: 0 },
};

// Initial Simulator Settings
export const INITIAL_SIMULATOR_SETTINGS: SimulatorSettings = {
  anesthesia: {
    vaporizers: [
      { gas: AnestheticGasType.SEVOFLURANE, level: 100 },
    ],
    sodaLimeRemainingPercent: 0,
    defaultFGF: 2.0,
    defaultAPL: 10,
    defaultTargetMAC: 1.0,
    defaultTargetEtSevo: 2.0,
    defaultTargetEtDes: 6.0,
    defaultTargetEtIso: 1.2,
  },
  patientProfile: {
    ...INITIAL_PATIENT_SETTINGS,
    ...PATIENT_PHYSIOLOGY_PRESETS_CONFIG.normal, // Includes new factors from normal preset
    selectedPreset: 'normal',
  },
  ventilationDefaults: {
    defaultInitialFio2: 40,
    defaultInitialPeep: 5,
    defaultModeICUInvasive: VentilationMode.VC,
    defaultModeICUNonInvasive: VentilationMode.CPAP,
    defaultModeAnesthesiaMechanical: VentilationMode.VC,
  },
  general: {
    anesthesia_post: { performed: false, dateTime: null },
    icu_general_post: { performed: false, dateTime: null },
    high_flow_post: { performed: false, dateTime: null, lastDisinfectionStatus: 'clean' as LastDisinfectionStatus },
    icu_invasive_post: { performed: false, dateTime: null },
    icu_noninvasive_post: { performed: false, dateTime: null },
    humidifierDefaultOn: false,
    humidifierDefaultTemp: 37,
    resetAlarmsOnNewPatient: true,
  },
  highFlow: {
      interfaceType: 'adult', // Default interface
      defaultFGFAdult: HIGH_FLOW_ADULT_FGF_MIN,
      defaultFGFJunior: HIGH_FLOW_PEDIATRIC_FGF_MIN,
      defaultTempAdult: HIGH_FLOW_TEMP_DEFAULT_ADULT,
      defaultTempJunior: HIGH_FLOW_TEMP_DEFAULT_JUNIOR,
      defaultFio2HighFlow: 60, // New default FiO2 for High Flow
      initialWaterLevelPercent: 100,
  },
};

export const HIGH_FLOW_WATER_CONSUMPTION_FACTOR_PER_L_FGF_PER_INTERVAL = 0.0022 / 30;
export const HIGH_FLOW_WATER_LOW_THRESHOLD_PERCENT = 10;

export const SWEEP_SPEED_OPTIONS: SweepSpeedOption[] = [
  { labelKey: 'sweepSpeed_10_label', value: 10, pixelRate: 1 }, // Slow
  { labelKey: 'sweepSpeed_25_label', value: 25, pixelRate: 2 }, // Medium (Default)
  { labelKey: 'sweepSpeed_50_label', value: 50, pixelRate: 4 }, // Fast
];

export const SWEEP_SPEED_TO_PIXEL_RATE_MAP: Record<SweepSpeedValue, number> = {
  10: 1,
  25: 2,
  50: 4,
};

// HIGH_FLOW_FGF constants already defined above
// HIGH_FLOW_TEMP constants already defined above
