
import { TranslationKeys } from './src/i18n/locales'; // Corrected path
import { VentilatorData } from './services/waveformService'; // Import from new service

export type { TranslationKeys, VentilatorData }; // Added VentilatorData and re-exported types

export enum VentilationMode {
  VC = 'VC', // Volume Control
  PC = 'PC', // Pressure Control
  PS = 'PS', // Pressure Support (Used for Anesthesia and Invasive/NIV SPONT/PS)
  SIMV = 'SIMV', // Synchronized Intermittent Mandatory Ventilation
  CPAP = 'CPAP', // Continuous Positive Airway Pressure
  HIGH_FLOW = 'HIGH_FLOW', // High Flow Oxygen Therapy
}

export type OperatingMode = 'anesthesia' | 'icu';
export type ICUSubMode = 'invasive' | 'non-invasive' | 'high-flow';

export enum AnestheticGasType {
  ISOFLURANE = 'isoflurane',
  SEVOFLURANE = 'sevoflurane',
  DESFLURANE = 'desflurane',
  N2O = 'n2o',
}

export enum PatientGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export interface PatientSettings {
  age: number | null;
  gender: PatientGender | null;
  weight: number | null; // in kg
}

export type AlarmParameterKey =
  | 'pPeak' | 'volumeMinute' | 'etco2' | 'fio2' | 'peep' | 'deliveredFlow' | 'frequency'
  | 'leakPercentage' | 'measuredFrequency' | 'inspiratoryCo2' | 'etAgentConcentration'
  | 'checkWater' | 'cannotReachTargetFlow' | 'checkTube';

export interface AlarmLimits {
  low: number | null;
  high: number | null;
  isOn: boolean;
}

export type AlarmSettings = Record<AlarmParameterKey, AlarmLimits>;

export interface HumidifierSettings {
  isOn: boolean;
  temperature: number; // e.g., in Celsius
}

export interface GasConfig {
  name: string;
  color: string; // Tailwind color class or hex for direct use
  mac: number;
  label: string; // Short label e.g., ISO
}

export interface VentModeConfig {
  name: string;
  color: string; // Tailwind color class or hex
  textColor?: string; // Optional text color for contrast
}

export type ParameterKey =
  | 'volume'
  | 'pressureTarget'
  | 'frequency'
  | 'peep'
  | 'fio2'
  | 'ratio'
  | 'psLevel'
  | 'triggerFlow'
  | 'inspiratoryPausePercent'
  | 'inspiratoryRiseTimeSeconds'
  | 'flowCycleOffPercent'
  | 'backupPressure'
  | 'backupFrequency'
  | 'backupIERatio'
  | 'pPeak'
  | 'pPlateau'
  | 'pMean'
  | 'measuredFrequency'
  | 'compliance'
  | 'resistance'
  | 'spontaneousRate'
  | 'fgf'
  | 'volumeMinute'
  | 'volumeInspired'
  | 'volumeExpired'
  | 'mlPerKg'
  | 'tiTtot'
  | 'leakPercentage'
  | 'etco2'
  | 'spo2'
  | 'humidifierTemperature'
  | 'heartRate'
  | 'bloodPressure'
  | 'temperature' // In HF, this is the TARGET temperature setting
  | 'deliveredTemperature' // In HF, this is the MONITORED delivered gas temperature
  | 'inspiratoryCo2'
  | 'targetMac'
  | 'etAgentConcentration'
  | 'etSecondaryAgentConcentration'
  | 'fiAgentConcentration'
  | 'fiSecondaryAgentConcentration'
  | 'targetEtPrimaryAgent'
  | 'targetEtSecondaryAgent'
  | 'waterLevelPercent'
  | 'lastDisinfectionStatus'
  | 'highFlowInterfaceType' // Added for High Flow interface type tracking in parameters
  | 'expiratoryEffortFactor'
  | 'inspiratoryEffortStrength'
  | 'expiratoryFlowLimitationFactor'
  | 'secretionsFactor';


export type HighFlowInterfaceType = 'adult' | 'pediatric' | 'junior'; // 'pediatric' and 'junior' are often grouped
export type LastDisinfectionStatus = 'clean' | 'dirty' | 'not_safe';

export interface ParameterSettings {
  labelKey: TranslationKeys;
  unitKey: TranslationKeys;
  isLarge?: boolean;
  displayCondition?: (mode: VentilationMode, opMode?: OperatingMode, icuSubMode?: ICUSubMode, isMechVent?: boolean | number) => boolean;
  isEditable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  valueFormatter?: (value: any) => string;
  isCalculated?: boolean;
  dynamicStep?: (currentValue: number, hfInterface?: HighFlowInterfaceType | null) => number;
}

export interface AllParameters {
  volume: number;
  pressureTarget: number;
  frequency: number;
  peep: number;
  fio2: number;
  ratio: string;
  psLevel: number;
  triggerFlow: number;
  pPeak: number | string;
  pPlateau: number | string;
  pMean: number | string;
  compliance: number | string;
  resistance: number | string;
  spontaneousRate: number;
  fgf: number;
  volumeMinute: number | string;
  volumeInspired: number | string;
  volumeExpired: number | string;
  etco2: number | string;
  spo2: number | string;
  heartRate: number | string;
  bloodPressure: string;
  temperature: number | string; // Target temperature for HF
  deliveredTemperature: number | string; // Monitored delivered gas temperature for HF
  mlPerKg: number | string;
  humidifierTemperature: number; // General humidifier circuit temp
  tiTtot: number | string;
  leakPercentage: number | string;
  measuredFrequency: number | string;
  inspiratoryPausePercent: number;
  inspiratoryRiseTimeSeconds: number;
  flowCycleOffPercent: number;
  backupPressure: number;
  backupFrequency: number;
  backupIERatio: string;
  inspiratoryCo2: number | string;
  targetMac: number;
  etAgentConcentration: number | string;
  etSecondaryAgentConcentration: number | string;
  fiAgentConcentration: number | string;
  fiSecondaryAgentConcentration: number | string;
  targetEtPrimaryAgent: number;
  targetEtSecondaryAgent: number;
  agentRemainingPercent: number;
  sodaLimeRemainingPercent: number;
  isMechanicalVentilation: number; // 0 for manual/spontaneous bag, 1 for mechanical
  waterLevelPercent: number | string;
  highFlowInterfaceType: HighFlowInterfaceType | null; // Added
  lastDisinfectionStatus: LastDisinfectionStatus | null;
  // New physiological factors for waveform modeling
  expiratoryEffortFactor: number;
  inspiratoryEffortStrength: number;
  expiratoryFlowLimitationFactor: number;
  secretionsFactor: number;
}

export type AgentLevels = Record<AnestheticGasType, number>;

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  textOnPrimary: string;
  buttonGradientFrom: string;
  buttonGradientTo: string;
  border: string;
  ring: string;
  graphColor1: string;
  graphColor2: string;
  graphColor3: string;
  modeButtonBg: string; // Background for the main mode indicator button (top-left)
  modeButtonText: string; // Text color for the main mode indicator button
  selectedModeButtonBg: string; // Background for selected mode in InlineModeSelector & ModeIndicatorButton
  selectedModeButtonText: string; // Text color for selected mode in InlineModeSelector & ModeIndicatorButton
}

export type ThemeName = 'anesthesia' | 'icu' | 'highFlow' | 'nonInvasive';

export interface SelfTestItem {
  nameKey: TranslationKeys;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
}

export type PostScreenKey =
  | 'anesthesia_post'
  | 'icu_general_post'
  | 'high_flow_post'
  | 'icu_invasive_post'
  | 'icu_noninvasive_post';

export interface PostScreenConfig {
  deviceTitleKey: TranslationKeys;
  theme: ThemeName;
  proceedsTo: 'patient_data' | 'icu_sub_selection' | 'high_flow_interface_selection' | 'icu_invasive_interface' | 'icu_noninvasive_interface';
  initialOperatingMode: OperatingMode;
  initialIcuSubMode?: ICUSubMode;
  initialHighFlowInterfaceType?: HighFlowInterfaceType; // Added
  testItems?: Omit<SelfTestItem, 'status'>[];
}

export interface ModalState {
  isOpen: boolean;
  paramKey: ParameterKey | null;
  paramLabel: string;
  currentValue: string;
  unit: string;
}

export type ActiveManeuver = 'insp_hold' | 'exp_hold' | null;

export interface ManeuverDisplayParameter {
  labelKey: TranslationKeys;
  result: {
    value: string;
    unitKey: TranslationKeys;
  };
}

export interface ManeuverResultsPackage {
  titleKey: 'maneuverResults_inspHold_title' | 'maneuverResults_expHold_title';
  parameters: ManeuverDisplayParameter[];
}

export interface PatientDataModalState {
  isOpen: boolean;
  pendingOperatingMode: OperatingMode | null;
  pendingIcuSubModeForSetup: ICUSubMode | null;
  pendingHighFlowInterfaceForSetup?: HighFlowInterfaceType | null; // Added
  overrideTitle?: TranslationKeys;
}

export type LastSelfTestResults = Partial<Record<PostScreenKey, string | null>>;

export interface DefaultAnestheticAgentSetting {
  gas: AnestheticGasType;
  level: number;
}

export interface DefaultSelfTestSetting {
  performed: boolean;
  dateTime: string | null;
  lastDisinfectionStatus?: LastDisinfectionStatus; // Only for high_flow_post
}

export type PatientPhysiologyPresetKey =
  | 'normal'
  | 'copd'
  | 'ards'
  | 'covid'
  | 'anaphylaxis'
  | 'pulmonaryEdema'
  | 'pneumonia'
  | 'fibroscopy';

export interface PatientPhysiologySettings extends PatientSettings {
  spontaneousRate: number;
  compliance: number;
  resistance: number;
  selectedPreset: PatientPhysiologyPresetKey | null;
  // New optional factors for waveform modeling
  expiratoryEffortFactor?: number; // 0-1, e.g., for grunting
  inspiratoryEffortStrength?: number; // 0-1, e.g., for accessory muscle use signs
  expiratoryFlowLimitationFactor?: number; // 0-1, e.g., for COPD "scooping"
  secretionsFactor?: number; // 0-1, for waveform oscillations
}

export interface HighFlowSpecificSettings {
  interfaceType: HighFlowInterfaceType | null; // This will now be primarily managed in AllParameters
  defaultFGFAdult: number;
  defaultFGFJunior: number;
  defaultTempAdult: number;
  defaultTempJunior: number;
  defaultFio2HighFlow: number; // New field for HF specific FiO2 default
  initialWaterLevelPercent: number;
}

export interface SimulatorSettings {
  anesthesia: {
    vaporizers: DefaultAnestheticAgentSetting[];
    sodaLimeRemainingPercent: number;
    defaultFGF: number;
    defaultAPL: number;
    defaultTargetMAC: number;
    defaultTargetEtSevo: number;
    defaultTargetEtDes: number;
    defaultTargetEtIso: number;
  };
  patientProfile: PatientPhysiologySettings;
  ventilationDefaults: {
    defaultInitialFio2: number;
    defaultInitialPeep: number;
    defaultModeICUInvasive: VentilationMode;
    defaultModeICUNonInvasive: VentilationMode;
    defaultModeAnesthesiaMechanical: VentilationMode;
  };
  general: {
    anesthesia_post: DefaultSelfTestSetting;
    icu_general_post: DefaultSelfTestSetting;
    high_flow_post: DefaultSelfTestSetting;
    icu_invasive_post: DefaultSelfTestSetting;
    icu_noninvasive_post: DefaultSelfTestSetting;
    humidifierDefaultOn: boolean;
    humidifierDefaultTemp: number;
    resetAlarmsOnNewPatient: boolean;
  };
  highFlow: HighFlowSpecificSettings; // Changed to use the interface
}

export interface SimulatorSettingsModalState {
  activeTab: 'anesthesia' | 'patientProfile' | 'ventilationDefaults' | 'general' | 'highFlow';
}

export interface AnesthesiaOffRequiredModalState {
  isOpen: boolean;
}

export interface ManualModalState {
  isOpen: boolean;
}

export type SweepSpeedValue = 10 | 25 | 50; // Conceptual speeds in mm/s

export interface SweepSpeedOption {
  labelKey: TranslationKeys; // e.g., 'sweepSpeed_10_label'
  value: SweepSpeedValue;
  pixelRate: number; // Corresponding SCANLINE_SPEED_PX_PER_FRAME
}
