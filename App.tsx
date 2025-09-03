
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StartupScreen } from './components/StartupScreen';
import { ICUModeSelectionScreen } from './components/ICUModeSelectionScreen';
import { VentilatorInterface } from './components/VentilatorInterface';
import { ParameterModal } from './components/ParameterModal';
import { PatientSettingsModal } from './components/PatientSettingsModal';
import { AlarmSettingsModal } from './components/AlarmSettingsModal';
import { PostScreen } from './components/PostScreen';
import { SelfTestPopup } from './components/SelfTestPopup';
import { SimulatorSettingsModal } from './components/SimulatorSettingsModal';
import { AnesthesiaOffRequiredModal } from './components/AnesthesiaOffRequiredModal';
import { ManualModal } from './components/ManualModal'; // New
import { LivePatientSettingsModal } from './components/LivePatientSettingsModal'; // New
import { VentilationMode, AnestheticGasType, ParameterKey, OperatingMode, ICUSubMode, PatientSettings, PatientPhysiologySettings, AlarmSettings, HumidifierSettings, AlarmParameterKey, ManeuverResultsPackage, ManeuverDisplayParameter, AgentLevels, PatientDataModalState, ThemeName, PostScreenKey, LastSelfTestResults, SelfTestItem, SimulatorSettings, AnesthesiaOffRequiredModalState, ManualModalState, ModalState, AllParameters, ActiveManeuver, SimulatorSettingsModalState, LastDisinfectionStatus, HighFlowInterfaceType, SweepSpeedValue, SweepSpeedOption, VentilatorData } from './types';
import { INITIAL_PARAMETERS, INITIAL_PATIENT_SETTINGS, INITIAL_ALARM_SETTINGS, PARAMETER_DEFINITIONS, THEME_CONFIG, INITIAL_HUMIDIFIER_SETTINGS, MANEUVER_HOLD_DURATION_MS, MANEUVER_UNIT_CMH2O, MANEUVER_UNIT_ML_CMH2O, MANEUVER_UNIT_CMH2O_L_S, MANEUVER_UNIT_CMH2O_L, MANEUVER_UNIT_ML, GAS_CONFIG, AGENT_CONSUMPTION_REFERENCE_FGF_L_MIN, AGENT_CONSUMPTION_DURATION_SECONDS_AT_REF_FGF, SODA_LIME_MAX_LIFETIME_HOURS_HIGH_FGF, SODA_LIME_MIN_LIFETIME_HOURS_LOW_FGF, SODA_LIME_FGF_HIGH_THRESHOLD_L_MIN, SODA_LIME_FGF_LOW_THRESHOLD_L_MIN, ET_AGENT_TIME_CONSTANT_FACTOR, ET_AGENT_MIN_FGF_EFFECT, INITIAL_AGENT_LEVELS, O2_FLUSH_DURATION_MS, SNOOZE_DURATION_MS, DEFAULT_SELF_TEST_ITEMS, ANESTHESIA_POST_SELF_TEST_ITEMS, VENTILATOR_POST_SELF_TEST_ITEMS, SELF_TEST_ITEM_DURATION_MS, POST_SCREEN_CONFIG, INITIAL_SIMULATOR_SETTINGS, ANESTHETIC_GAS_ORDER, HIGH_FLOW_WATER_CONSUMPTION_FACTOR_PER_L_FGF_PER_INTERVAL, HIGH_FLOW_WATER_LOW_THRESHOLD_PERCENT, AMBIENT_TEMPERATURE, HIGH_FLOW_ADULT_FGF_MIN, HIGH_FLOW_PEDIATRIC_FGF_MIN, HIGH_FLOW_TEMP_DEFAULT_ADULT, HIGH_FLOW_TEMP_DEFAULT_JUNIOR, HIGH_FLOW_TEMP_MAX_JUNIOR, HIGH_FLOW_ADULT_FGF_MAX, HIGH_FLOW_PEDIATRIC_FGF_MAX, SWEEP_SPEED_OPTIONS, SWEEP_SPEED_TO_PIXEL_RATE_MAP, HIGH_FLOW_TEMP_MAX_ADULT, HIGH_FLOW_TEMP_MIN, HIGH_FLOW_PEDIATRIC_FGF_MAX as HIGH_FLOW_PEDIATRIC_FGF_MAX_CONSTANT, ALARMABLE_PARAMETERS_CONFIG } from './constants'; // Aliased import for clarity
import { useLanguage } from './src/contexts/LanguageContext';
import { TranslationKeys } from './src/i18n/locales';
import { getVentilatorData } from './services/waveformService';


const calculateInspiratoryFraction = (mode: VentilationMode, ratioString: string | undefined, psLevel?: number): number => {
    if (mode === VentilationMode.PS || (mode === VentilationMode.SIMV && psLevel && psLevel > 0)) {
        return 1/3;
    }
    const ratio = String(ratioString || "1:2").split(':').map(Number);
    const iPart = ratio[0] || 1;
    const ePart = ratio[1] || 2;
    if (iPart + ePart === 0) return 0.33;
    return iPart / (iPart + ePart);
};

const getUpdatedRatesForMode = (
  mode: VentilationMode,
  setFrequency: number,
  psLevel: number,
  baseSpontaneousRate: number
): { measuredFrequency: number; spontaneousRate: number } => {
  let spontaneousRate = 0;
  let measuredFrequency = setFrequency;

  if (mode === VentilationMode.PS || mode === VentilationMode.CPAP) {
    spontaneousRate = baseSpontaneousRate > 0 ? baseSpontaneousRate : 12; // Default to 12 if no base rate
    measuredFrequency = spontaneousRate;
  } else if (mode === VentilationMode.VC || mode === VentilationMode.PC) {
    spontaneousRate = 0; // Controlled modes, no spontaneous breathing
    measuredFrequency = setFrequency;
  } else if (mode === VentilationMode.SIMV) {
    spontaneousRate = baseSpontaneousRate > 0 ? baseSpontaneousRate : 0; // Allow spontaneous breaths
    measuredFrequency = setFrequency + spontaneousRate; // Total rate is sum
  }

  return { measuredFrequency, spontaneousRate };
};


const App: React.FC = () => {
  const { t } = useLanguage();

  const [simulatorSettings, setSimulatorSettings] = useState<SimulatorSettings>(INITIAL_SIMULATOR_SETTINGS);
  const [isSimulatorSettingsModalOpen, setIsSimulatorSettingsModalOpen] = useState<boolean>(false);
  const [isLivePatientSettingsModalOpen, setIsLivePatientSettingsModalOpen] = useState(false);


  const [isSimulatorOn, setIsSimulatorOn] = useState<boolean>(false);
  const [isVentilationActive, setIsVentilationActive] = useState<boolean>(false);
  const [isWarmingUpHF, setIsWarmingUpHF] = useState<boolean>(false);

  const [operatingMode, setOperatingMode] = useState<OperatingMode | null>(null);
  const [icuSubMode, setIcuSubMode] = useState<ICUSubMode | null>(null);
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeName>('icu');

  // POST Screen State
  const [currentPostScreenKey, setCurrentPostScreenKey] = useState<PostScreenKey | null>(null);
  const [lastSelfTestResults, setLastSelfTestResults] = useState<LastSelfTestResults>(() => {
    const initialResults: LastSelfTestResults = {};
    for (const key in INITIAL_SIMULATOR_SETTINGS.general) {
        if (Object.prototype.hasOwnProperty.call(INITIAL_SIMULATOR_SETTINGS.general, key) && POST_SCREEN_CONFIG[key as PostScreenKey]) {
            const setting = INITIAL_SIMULATOR_SETTINGS.general[key as PostScreenKey];
            if (setting.performed && setting.dateTime) {
                initialResults[key as PostScreenKey] = setting.dateTime;
            } else {
                initialResults[key as PostScreenKey] = null;
            }
        }
    }
    return initialResults;
  });
  const [isSelfTestRunning, setIsSelfTestRunning] = useState<boolean>(false);
  const [selfTestProgressItems, setSelfTestProgressItems] = useState<SelfTestItem[]>([]);
  const [selectedIcuSubModeOnPostScreen, setSelectedIcuSubModeOnPostScreen] = useState<ICUSubMode>('invasive');

  // Disinfection Cycle State
  const [isDisinfecting, setIsDisinfecting] = useState<boolean>(false);
  const [disinfectionProgressItem, setDisinfectionProgressItem] = useState<SelfTestItem | null>(null);


  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [currentMode, setCurrentMode] = useState<VentilationMode>(simulatorSettings.ventilationDefaults.defaultModeICUInvasive);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState<boolean>(false);
  const [isAnesthesiaActive, setIsAnesthesiaActive] = useState<boolean>(false);

  const [selectedAnestheticGases, setSelectedAnestheticGases] = useState<AnestheticGasType[]>(() =>
    INITIAL_SIMULATOR_SETTINGS.anesthesia.vaporizers.length > 0 ? [INITIAL_SIMULATOR_SETTINGS.anesthesia.vaporizers[0].gas] : (ANESTHETIC_GAS_ORDER[0] ? [ANESTHETIC_GAS_ORDER[0]] : [])
  );
  const [agentLevels, setAgentLevels] = useState<AgentLevels>(() => {
    const levels: AgentLevels = {} as AgentLevels;
    ANESTHETIC_GAS_ORDER.forEach(gas => levels[gas] = 100);
    INITIAL_SIMULATOR_SETTINGS.anesthesia.vaporizers.forEach(vaporizer => {
        levels[vaporizer.gas] = vaporizer.level;
    });
    return levels;
  });

  const [ventilatorData, setVentilatorData] = useState<VentilatorData | null>(null);

  const [parameters, setParameters] = useState<AllParameters>(() => ({
    ...INITIAL_PARAMETERS,
    isMechanicalVentilation: 0,
    compliance: simulatorSettings.patientProfile.compliance || INITIAL_PARAMETERS.compliance,
    resistance: simulatorSettings.patientProfile.resistance || INITIAL_PARAMETERS.resistance,
    spontaneousRate: simulatorSettings.patientProfile.spontaneousRate || INITIAL_PARAMETERS.spontaneousRate,
    expiratoryEffortFactor: simulatorSettings.patientProfile.expiratoryEffortFactor ?? 0,
    inspiratoryEffortStrength: simulatorSettings.patientProfile.inspiratoryEffortStrength ?? 0,
    expiratoryFlowLimitationFactor: simulatorSettings.patientProfile.expiratoryFlowLimitationFactor ?? 0,
    secretionsFactor: simulatorSettings.patientProfile.secretionsFactor ?? 0,
    sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
    fgf: simulatorSettings.anesthesia.defaultFGF,
    peep: simulatorSettings.anesthesia.defaultAPL,
    fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2,
    targetMac: simulatorSettings.anesthesia.defaultTargetMAC,
    temperature: simulatorSettings.highFlow.defaultTempAdult, // Use HF specific default
    deliveredTemperature: AMBIENT_TEMPERATURE,
    humidifierTemperature: simulatorSettings.general.humidifierDefaultTemp,
    waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
    lastDisinfectionStatus: simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean',
    highFlowInterfaceType: simulatorSettings.highFlow.interfaceType || 'adult',
  }));

  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, paramKey: null, paramLabel: '', currentValue: '', unit: '' });
  const [isModeChanging, setIsModeChanging] = useState<boolean>(false);

  const [patientSettings, setPatientSettings] = useState<PatientSettings>(() => ({
      age: simulatorSettings.patientProfile.age,
      gender: simulatorSettings.patientProfile.gender,
      weight: simulatorSettings.patientProfile.weight,
  }));
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(INITIAL_ALARM_SETTINGS);
  const [humidifierSettings, setHumidifierSettings] = useState<HumidifierSettings>(() => ({
    isOn: simulatorSettings.general.humidifierDefaultOn,
    temperature: simulatorSettings.general.humidifierDefaultTemp,
  }));

  const [patientDataModalInfo, setPatientDataModalInfo] = useState<PatientDataModalState>({ isOpen: false, pendingOperatingMode: null, pendingIcuSubModeForSetup: null, pendingHighFlowInterfaceForSetup: null });

  const [isAlarmSettingsModalOpen, setIsAlarmSettingsModalOpen] = useState<boolean>(false);
  const [activeAlarms, setActiveAlarms] = useState<Partial<Record<AlarmParameterKey, boolean>>>({});
  const [hasActiveAlarmsState, setHasActiveAlarmsState] = useState<boolean>(false);
  const [isAlarmSnoozed, setIsAlarmSnoozed] = useState<boolean>(false);
  const snoozeTimeoutId = useRef<number | null>(null);
  const [snoozeCountdownDisplay, setSnoozeCountdownDisplay] = useState<number | null>(null);
  const snoozeDisplayIntervalIdRef = useRef<number | null>(null);


  const [areWaveformsFrozen, setAreWaveformsFrozen] = useState<boolean>(false);
  const [activeManeuver, setActiveManeuver] = useState<ActiveManeuver>(null);
  const [maneuverStartTime, setManeuverStartTime] = useState<number | null>(null);
  const [heldVolumeInspired, setHeldVolumeInspired] = useState<number>(0);

  const [maneuverResultsPackage, setManeuverResultsPackage] = useState<ManeuverResultsPackage | null>(null);
  const [capturedPpeakForResistance, setCapturedPpeakForResistance] = useState<number | null>(null);
  const [capturedAvgInspFlowLPS, setCapturedAvgInspFlowLPS] = useState<number | null>(null);

  const [anesthesiaStartTime, setAnesthesiaStartTime] = useState<number | null>(null);
  const [isO2FlushActive, setIsO2FlushActive] = useState<boolean>(false);
  const [o2FlushTimerEnd, setO2FlushTimerEnd] = useState<number | null>(null);
  const [preFlushFio2, setPreFlushFio2] = useState<number | null>(null);
  const [isMechanicalVentilation, setIsMechanicalVentilation] = useState<boolean>(false);

  const [isRefillingAgents, setIsRefillingAgents] = useState<AnestheticGasType[]>([]);
  const [isReplacingSodaLime, setIsReplacingSodaLime] = useState<boolean>(false);
  const [anesthesiaOffRequiredModalOpen, setAnesthesiaOffRequiredModalOpen] = useState<boolean>(false);
  const [refillStartTime, setRefillStartTime] = useState<number | null>(null);
  const [initialAgentLevelsForAnimation, setInitialAgentLevelsForAnimation] = useState<Partial<AgentLevels> | null>(null);
  const [initialSodaLimeLevelForAnimation, setInitialSodaLimeLevelForAnimation] = useState<number | null>(null);

  const [manualModalState, setManualModalState] = useState<ManualModalState>({ isOpen: false });

  const [isRecordingEnabledForNextSession, setIsRecordingEnabledForNextSession] = useState<boolean>(false);
  const [isSessionActiveRecording, setIsSessionActiveRecording] = useState<boolean>(false);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const isSessionActiveRecordingRef = useRef(isSessionActiveRecording);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const hfTempRampRef = useRef<{ startVal: number, endVal: number, startTime: number } | null>(null);
  const [alarmAudio, setAlarmAudio] = useState<HTMLAudioElement | null>(null);

  const [currentSweepSpeedValue, setCurrentSweepSpeedValue] = useState<SweepSpeedValue>(10); // Default to 10 mm/s
  const [effectiveScanlinePixelRate, setEffectiveScanlinePixelRate] = useState<number>(SWEEP_SPEED_TO_PIXEL_RATE_MAP[10]); // Default to 10 mm/s pixel rate

  // Load ventilator data when mode changes
  useEffect(() => {
    if (isSimulatorOn && operatingMode && icuSubMode !== 'high-flow') {
      getVentilatorData(currentMode).then(data => {
        setVentilatorData(data);
      });
    } else {
      setVentilatorData(null);
    }
  }, [isSimulatorOn, operatingMode, icuSubMode, currentMode]);

  const logSessionEvent = useCallback((eventDescriptionKey: TranslationKeys, details?: Record<string, any> | string | number | null, value?: string | number) => {
    if (isSessionActiveRecordingRef.current && sessionStartTime) {
        const elapsedTimeSeconds = (Date.now() - sessionStartTime) / 1000;
        const timestamp = `T+${elapsedTimeSeconds.toFixed(1)}s`;
        let logEntry = `${timestamp} - ${t[eventDescriptionKey] || eventDescriptionKey.toString()}`;

        let detailString = "";
        if (details !== undefined && details !== null) {
            if (typeof details === 'object') {
                detailString = JSON.stringify(details);
            } else {
                detailString = String(details);
            }
        }
        if (value !== undefined) {
          detailString += (detailString ? ", Value: " : "Value: ") + String(value);
        }

        if (detailString) {
          logEntry += `: ${detailString}`;
        }
        setSessionLog(prevLog => [...prevLog, logEntry]);
    }
  }, [t, sessionStartTime]);

  const handleChangeSweepSpeed = useCallback(() => {
    setCurrentSweepSpeedValue(prevSpeed => {
      const currentIndex = SWEEP_SPEED_OPTIONS.findIndex(opt => opt.value === prevSpeed);
      const nextIndex = (currentIndex + 1) % SWEEP_SPEED_OPTIONS.length;
      const newSpeedOption = SWEEP_SPEED_OPTIONS[nextIndex];
      setEffectiveScanlinePixelRate(newSpeedOption.pixelRate);
      logSessionEvent('record_log_sweep_speed_changed', { speed: newSpeedOption.value });
      return newSpeedOption.value;
    });
  }, [logSessionEvent]);

  const handleClearManeuverResults = useCallback(() => {
    setManeuverResultsPackage(null);
  }, []);


  useEffect(() => {
    isSessionActiveRecordingRef.current = isSessionActiveRecording;
  }, [isSessionActiveRecording]);

 useEffect(() => {
    let audioInstance: HTMLAudioElement | null = null;
    let objectUrl: string | null = null;

    const setupAudio = async () => {
        try {
            const response = await fetch('alarm.mp3'); // Fetches relative to index.html
            if (!response.ok) {
                // Log specific HTTP error and the resolved path
                const resolvedPath = new URL('alarm.mp3', window.location.href).href;
                throw new Error(`HTTP error! Status: ${response.status}. Failed to fetch 'alarm.mp3' (resolved to: ${resolvedPath})`);
            }
            const blob = await response.blob();

            // Optional: Check MIME type if you want to be strict, though browsers are often lenient with Object URLs
            if (blob.type && !blob.type.startsWith('audio/')) {
                 console.warn(`Alarm.mp3 fetched, but MIME type is '${blob.type}'. Expected 'audio/*'. Trying to play anyway.`);
            }
            
            objectUrl = URL.createObjectURL(blob);
            audioInstance = new Audio(objectUrl);
            audioInstance.loop = true;

            audioInstance.oncanplaythrough = () => {
                console.log("Alarm sound (alarm.mp3 via fetch & ObjectURL) can play through.");
                setAlarmAudio(audioInstance); // Set to state only when ready
            };

            audioInstance.onerror = (e) => {
                let errorDetails = "Unknown error with fetched audio object.";
                if (audioInstance?.error) {
                    errorDetails = `Audio Element Error Code: ${audioInstance.error.code}, Message: ${audioInstance.error.message || 'No specific message.'}`;
                } else if (typeof e === 'object' && e !== null) {
                    errorDetails = `Error event: ${JSON.stringify(e)}`;
                }
                console.error(`Failed to play alarm.mp3 (loaded via fetch & ObjectURL). Details: ${errorDetails}`);
                if (objectUrl) { // Clean up object URL if playback fails after creation
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null; 
                }
                 setAlarmAudio(null); // Ensure alarmAudio state is null on error
            };
            
            // audioInstance.load(); // Not always necessary, src assignment usually triggers load.
        } catch (fetchError) {
            // This error means the file likely wasn't found or network issue
             const resolvedPath = new URL('alarm.mp3', window.location.href).href;
            console.error(`Failed to fetch 'alarm.mp3' (tried ${resolvedPath}). Ensure it's in the root directory alongside index.html. Error:`, fetchError);
            setAlarmAudio(null); // Ensure alarmAudio state is null on error
        }
    };

    setupAudio();

    return () => {
        if (audioInstance) {
            audioInstance.pause();
            audioInstance.removeAttribute('src'); // Release resources
            audioInstance.load(); // Abort loading
            audioInstance.oncanplaythrough = null;
            audioInstance.onerror = null;
        }
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
        setAlarmAudio(null); // Clear from state on cleanup
    };
  }, []);


  useEffect(() => {
    if (!alarmAudio) return;

    if (hasActiveAlarmsState && !isAlarmSnoozed) {
        const playPromise = alarmAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Alarm sound autoplay was prevented or failed. User interaction might be required. Error:", error);
            });
        }
    } else {
        alarmAudio.pause();
        if (alarmAudio.currentTime > 0) { 
          alarmAudio.currentTime = 0;
        }
    }
  }, [hasActiveAlarmsState, isAlarmSnoozed, alarmAudio]);




  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    let themeToSet: ThemeName = 'icu';
    if (currentPostScreenKey) {
        themeToSet = POST_SCREEN_CONFIG[currentPostScreenKey].theme;
        if (currentPostScreenKey === 'icu_general_post') {
            themeToSet = selectedIcuSubModeOnPostScreen === 'non-invasive' ? 'nonInvasive' : 'icu';
        }
    } else if (operatingMode === 'anesthesia') {
        themeToSet = 'anesthesia';
    } else if (operatingMode === 'icu') {
        if (icuSubMode === 'high-flow') themeToSet = 'highFlow';
        else if (icuSubMode === 'non-invasive') themeToSet = 'nonInvasive';
        else themeToSet = 'icu';
    }
    setEffectiveTheme(themeToSet);
  }, [operatingMode, icuSubMode, currentPostScreenKey, selectedIcuSubModeOnPostScreen]);

  const updateSimulationState = useCallback((params: AllParameters, modeOverride?: VentilationMode) => {
      const activeMode = modeOverride || currentMode;
      const newMonitoredParams = { ...params };
      const currentFGF = Number(params.fgf);
      let currentSodaLimeConsumption = Number(params.sodaLimeRemainingPercent);

      let etPrimaryAgentConc = Number(params.etAgentConcentration);
      let etSecondaryAgentConc = Number(params.etSecondaryAgentConcentration);
      const currentTargetMac = Number(params.targetMac);

      if (operatingMode === 'anesthesia') {
        if (isAnesthesiaActive && anesthesiaStartTime) {
          const activeGases = selectedAnestheticGases.filter(gas => agentLevels[gas] > 0);
          const numActiveGases = activeGases.length;
          const targetMacPerAgent = numActiveGases > 0 ? currentTargetMac / numActiveGases : 0;

          activeGases.forEach((gas, index) => {
            const agentConfig = GAS_CONFIG[gas];
            let currentAgentLevel = agentLevels[gas];
            let currentEtAgentForThisGas = index === 0 ? etPrimaryAgentConc : etSecondaryAgentConc;

            if (currentAgentLevel > 0 && currentFGF > 0 && !isRefillingAgents.includes(gas)) {
                const consumptionPerAgentPerSecond = (currentFGF / AGENT_CONSUMPTION_REFERENCE_FGF_L_MIN) * (100 / AGENT_CONSUMPTION_DURATION_SECONDS_AT_REF_FGF);
                const consumptionThisInterval = consumptionPerAgentPerSecond * 2;
                currentAgentLevel = Math.max(0, currentAgentLevel - consumptionThisInterval);
                 setAgentLevels(prevLevels => ({...prevLevels, [gas]: parseFloat(currentAgentLevel.toFixed(2))}));
            }

            if (currentAgentLevel > 0) {
                const targetEtPercentForThisGas = targetMacPerAgent * agentConfig.mac;
                const fgfEffectFactor = Math.max(ET_AGENT_MIN_FGF_EFFECT, currentFGF) * ET_AGENT_TIME_CONSTANT_FACTOR;
                const deltaEtAgent = (targetEtPercentForThisGas - currentEtAgentForThisGas) * fgfEffectFactor;
                currentEtAgentForThisGas += deltaEtAgent;
                currentEtAgentForThisGas = Math.max(0, currentEtAgentForThisGas);
            } else {
                const fgfEffectFactor = Math.max(ET_AGENT_MIN_FGF_EFFECT, currentFGF) * ET_AGENT_TIME_CONSTANT_FACTOR;
                const deltaEtAgent = (0 - currentEtAgentForThisGas) * fgfEffectFactor;
                currentEtAgentForThisGas += deltaEtAgent;
                currentEtAgentForThisGas = Math.max(0, currentEtAgentForThisGas);
            }

            if (index === 0) {
                newMonitoredParams.etAgentConcentration = parseFloat(currentEtAgentForThisGas.toFixed(2));
                etPrimaryAgentConc = currentEtAgentForThisGas;
            } else if (index === 1) {
                newMonitoredParams.etSecondaryAgentConcentration = parseFloat(currentEtAgentForThisGas.toFixed(2));
                etSecondaryAgentConc = currentEtAgentForThisGas;
            }
          });

          if (selectedAnestheticGases.length < 2) {
            const fgfEffectFactor = Math.max(ET_AGENT_MIN_FGF_EFFECT, currentFGF) * ET_AGENT_TIME_CONSTANT_FACTOR;
            const deltaEtAgent = (0 - etSecondaryAgentConc) * fgfEffectFactor;
            etSecondaryAgentConc += deltaEtAgent;
            newMonitoredParams.etSecondaryAgentConcentration = parseFloat(Math.max(0, etSecondaryAgentConc).toFixed(2));
          }
        } else {
            const fgfEffectFactor = Math.max(ET_AGENT_MIN_FGF_EFFECT, currentFGF) * ET_AGENT_TIME_CONSTANT_FACTOR;
            etPrimaryAgentConc += (0 - etPrimaryAgentConc) * fgfEffectFactor;
            etSecondaryAgentConc += (0 - etSecondaryAgentConc) * fgfEffectFactor;
            newMonitoredParams.etAgentConcentration = parseFloat(Math.max(0, etPrimaryAgentConc).toFixed(2));
            newMonitoredParams.etSecondaryAgentConcentration = parseFloat(Math.max(0, etSecondaryAgentConc).toFixed(2));
        }

        if (anesthesiaStartTime && !isReplacingSodaLime) {
            if (currentSodaLimeConsumption < 100) {
                let rebreathingFactor = 0;
                if (currentFGF < SODA_LIME_FGF_LOW_THRESHOLD_L_MIN) rebreathingFactor = 1;
                else if (currentFGF < SODA_LIME_FGF_HIGH_THRESHOLD_L_MIN) rebreathingFactor = 1 - ( (currentFGF - SODA_LIME_FGF_LOW_THRESHOLD_L_MIN) / (SODA_LIME_FGF_HIGH_THRESHOLD_L_MIN - SODA_LIME_FGF_LOW_THRESHOLD_L_MIN) );

                const currentSodaLimeLifetimeHours = SODA_LIME_MAX_LIFETIME_HOURS_HIGH_FGF - rebreathingFactor * (SODA_LIME_MAX_LIFETIME_HOURS_HIGH_FGF - SODA_LIME_MIN_LIFETIME_HOURS_LOW_FGF);
                const sodaLimeConsumptionIncreasePerSecond = (currentSodaLimeLifetimeHours > 0) ? (100 / (currentSodaLimeLifetimeHours * 3600)) : 0.1;
                currentSodaLimeConsumption = Math.min(100, currentSodaLimeConsumption + sodaLimeConsumptionIncreasePerSecond * 2);
                newMonitoredParams.sodaLimeRemainingPercent = parseFloat(currentSodaLimeConsumption.toFixed(2));
            } else {
                newMonitoredParams.sodaLimeRemainingPercent = 100;
            }
        }
        if (isMechanicalVentilation) {
            let baseInspiredCo2 = 0;
            const randomFluctuation = Math.random() * 0.3 - 0.15;
            if (currentSodaLimeConsumption > 85) baseInspiredCo2 = 5 + Math.random() * 5;
            else if (currentSodaLimeConsumption > 50 && currentFGF < 1.0) baseInspiredCo2 = 2 + Math.random() * 2;
            else if (currentFGF < 0.75 && currentSodaLimeConsumption > 20) baseInspiredCo2 = 1.0 + Math.random() * 1;
            else if (currentFGF < 1.5 && currentSodaLimeConsumption > 10) baseInspiredCo2 = 0.5 + Math.random() * 0.5;
            else baseInspiredCo2 = 0.1 + Math.random() * 0.2;
            newMonitoredParams.inspiratoryCo2 = parseFloat(Math.min(20, Math.max(0, baseInspiredCo2 + randomFluctuation)).toFixed(1));
        } else {
            newMonitoredParams.inspiratoryCo2 = 0;
        }

      } else if (operatingMode === 'icu' && icuSubMode === 'high-flow') {
        if (isVentilationActive) {
            let currentWaterLevel = Number(params.waterLevelPercent);
            if (currentWaterLevel > 0) {
                const waterConsumptionThisInterval = currentFGF * HIGH_FLOW_WATER_CONSUMPTION_FACTOR_PER_L_FGF_PER_INTERVAL;
                currentWaterLevel = Math.max(0, currentWaterLevel - waterConsumptionThisInterval);
                newMonitoredParams.waterLevelPercent = parseFloat(currentWaterLevel.toFixed(2));
            }
        }

        const targetHfDeliveredTemp = (isWarmingUpHF || isVentilationActive) ? Number(params.temperature) : AMBIENT_TEMPERATURE;
        let currentDeliveredTemp = Number(params.deliveredTemperature);

        if (hfTempRampRef.current === null || hfTempRampRef.current.endVal !== targetHfDeliveredTemp) {
            if (Math.abs(currentDeliveredTemp - targetHfDeliveredTemp) > 0.05) {
                hfTempRampRef.current = {
                    startVal: currentDeliveredTemp,
                    endVal: targetHfDeliveredTemp,
                    startTime: Date.now()
                };
            } else {
                hfTempRampRef.current = null;
                if (currentDeliveredTemp !== targetHfDeliveredTemp) currentDeliveredTemp = targetHfDeliveredTemp; // Snap if very close
            }
        }

        if (hfTempRampRef.current) {
            const ramp = hfTempRampRef.current;
            const RAMP_DURATION_MS = 15 * 1000;
            const elapsedTime = Date.now() - ramp.startTime;
            const progress = Math.min(1, elapsedTime / RAMP_DURATION_MS);

            currentDeliveredTemp = ramp.startVal + (ramp.endVal - ramp.startVal) * progress;

            if (progress >= 1) {
                currentDeliveredTemp = ramp.endVal;
                hfTempRampRef.current = null;
            }
        }

        newMonitoredParams.deliveredTemperature = parseFloat(currentDeliveredTemp.toFixed(1));

        if (isWarmingUpHF) {
            const userTargetTemp = Number(params.temperature);
            const finalDeliveredTempForCheck = Number(newMonitoredParams.deliveredTemperature);

            if (finalDeliveredTempForCheck === parseFloat(userTargetTemp.toFixed(1))) {
                setIsWarmingUpHF(false);
                setIsVentilationActive(true);
                hfTempRampRef.current = null;
                logSessionEvent('record_log_ventilation_started');
            }
        }

      } else {
        newMonitoredParams.etAgentConcentration = 0;
        newMonitoredParams.etSecondaryAgentConcentration = 0;
        newMonitoredParams.inspiratoryCo2 = 0;
        if (operatingMode === 'icu' && icuSubMode !== 'high-flow' && humidifierSettings.isOn) {
            newMonitoredParams.humidifierTemperature = humidifierSettings.temperature;
        }
      }


      if (isVentilationActive && (operatingMode === 'anesthesia' ? isMechanicalVentilation : (operatingMode === 'icu' && icuSubMode !== 'high-flow'))) {
        if (activeManeuver && maneuverStartTime) {
          if (Date.now() - maneuverStartTime > MANEUVER_HOLD_DURATION_MS) {
            const resultsParams: ManeuverDisplayParameter[] = [];
            let resultsTitleKey: 'maneuverResults_inspHold_title' | 'maneuverResults_expHold_title' = 'maneuverResults_inspHold_title';

            if (activeManeuver === 'insp_hold') {
              resultsTitleKey = 'maneuverResults_inspHold_title';
              const ppeak_val = capturedPpeakForResistance !== null ? capturedPpeakForResistance : Number(newMonitoredParams.pPlateau);
              const pplat_val = Number(newMonitoredParams.pPlateau);
              const peep_val = Number(newMonitoredParams.peep);
              const pdrive_val = pplat_val - peep_val;
              const vti_liters = heldVolumeInspired / 1000;

              resultsParams.push({ labelKey: 'maneuver_param_ppeak_label', result: { value: ppeak_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_pplat_label', result: { value: pplat_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_peep_label', result: { value: peep_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_vti_held_label', result: { value: heldVolumeInspired.toFixed(0), unitKey: MANEUVER_UNIT_ML }});

              if (pdrive_val > 0 && vti_liters > 0) {
                resultsParams.push({ labelKey: 'maneuver_param_pdrive_label', result: { value: pdrive_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O }});
                const crs_liters_cmH2O = vti_liters / pdrive_val;
                const crs_ml_cmH2O = crs_liters_cmH2O * 1000;
                resultsParams.push({ labelKey: 'maneuver_param_crs_label', result: { value: crs_ml_cmH2O.toFixed(1), unitKey: MANEUVER_UNIT_ML_CMH2O }});
                const elastance_val = 1 / crs_liters_cmH2O;
                resultsParams.push({ labelKey: 'maneuver_param_elastance_label', result: { value: elastance_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O_L }});
              } else {
                resultsParams.push({ labelKey: 'maneuver_param_pdrive_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O }});
                resultsParams.push({ labelKey: 'maneuver_param_crs_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_ML_CMH2O }});
                resultsParams.push({ labelKey: 'maneuver_param_elastance_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O_L }});
              }

              if (capturedAvgInspFlowLPS && capturedAvgInspFlowLPS > 0 && capturedPpeakForResistance !== null && (capturedPpeakForResistance - pplat_val) >= 0) {
                const resistance_val = (capturedPpeakForResistance - pplat_val) / capturedAvgInspFlowLPS;
                resultsParams.push({ labelKey: 'maneuver_param_resistance_label', result: { value: resistance_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O_L_S }});
              } else {
                resultsParams.push({ labelKey: 'maneuver_param_resistance_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O_L_S }});
              }
            } else if (activeManeuver === 'exp_hold') {
              resultsTitleKey = 'maneuverResults_expHold_title';
              const peeptot_val = Number(newMonitoredParams.peep);
              resultsParams.push({ labelKey: 'maneuver_param_peeptot_label', result: { value: peeptot_val.toFixed(1), unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_ppeak_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_pplat_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_pdrive_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_crs_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_ML_CMH2O }});
              resultsParams.push({ labelKey: 'maneuver_param_elastance_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O_L }});
              resultsParams.push({ labelKey: 'maneuver_param_resistance_label', result: { value: t.valueNotAvailable, unitKey: MANEUVER_UNIT_CMH2O_L_S }});
            }

            const logDetails: Record<string, string> = {};
            resultsParams.forEach(param => {
                if (param.result.value !== t.valueNotAvailable) {
                    const label = t[param.labelKey] || param.labelKey;
                    const unit = param.result.unitKey !== 'unit_none' ? ` ${t[param.result.unitKey] || ''}` : '';
                    logDetails[label] = `${param.result.value}${unit}`.trim();
                }
            });

            if (activeManeuver === 'insp_hold') {
                logSessionEvent('record_log_insp_hold_results', logDetails);
            } else if (activeManeuver === 'exp_hold') {
                logSessionEvent('record_log_exp_hold_results', logDetails);
            }

            setManeuverResultsPackage({ titleKey: resultsTitleKey, parameters: resultsParams });
            setActiveManeuver(null);
            setManeuverStartTime(null);
            setCapturedPpeakForResistance(null);
            setCapturedAvgInspFlowLPS(null);

          } else {
            if (activeManeuver === 'insp_hold') {
              newMonitoredParams.pPeak = newMonitoredParams.pPlateau;
              if (activeMode === VentilationMode.PS || activeMode === VentilationMode.SIMV && Number(params.psLevel) > 0) {
                  newMonitoredParams.pPlateau = Number(params.peep) + Number(params.psLevel);
                  newMonitoredParams.pPeak = Number(params.peep) + Number(params.psLevel);
              } else if (activeMode === VentilationMode.PC) {
                  newMonitoredParams.pPlateau = Number(params.peep) + Number(params.pressureTarget);
                  newMonitoredParams.pPeak = Number(params.peep) + Number(params.pressureTarget);
              }
              newMonitoredParams.pMean = newMonitoredParams.pPlateau;
              newMonitoredParams.volumeInspired = heldVolumeInspired;
              newMonitoredParams.volumeExpired = 0;
              newMonitoredParams.volumeMinute = 0;
              newMonitoredParams.measuredFrequency = 0;
              newMonitoredParams.tiTtot = 1;
            } else if (activeManeuver === 'exp_hold') {
              newMonitoredParams.pPeak = newMonitoredParams.peep;
              newMonitoredParams.pPlateau = newMonitoredParams.peep;
              newMonitoredParams.pMean = newMonitoredParams.peep;
              newMonitoredParams.volumeInspired = 0;
              newMonitoredParams.volumeExpired = 0;
              newMonitoredParams.volumeMinute = 0;
              newMonitoredParams.measuredFrequency = 0;
              newMonitoredParams.tiTtot = 0;
            }
            return newMonitoredParams;
          }
        }

        const patientCompliance = Number(params.compliance) || 50;
        const patientResistance = Number(params.resistance) || 10;

        const inspiratoryFraction = calculateInspiratoryFraction(activeMode, String(params.ratio), Number(params.psLevel));
        newMonitoredParams.tiTtot = parseFloat(inspiratoryFraction.toFixed(2));

        const freqForMV = Number(params.measuredFrequency);
        const breathPeriodMs = freqForMV > 0 ? (60 / freqForMV) * 1000 : 5000;
        const inspPausePercent = (activeMode === VentilationMode.VC || (activeMode === VentilationMode.SIMV && Number(params.psLevel) === 0)) ? Number(params.inspiratoryPausePercent) || 0 : 0;
        const Ti = breathPeriodMs * inspiratoryFraction;
        const Tip = Ti * (inspPausePercent / 100);
        const Tif = Ti - Tip;

        if (activeMode === VentilationMode.VC || (activeMode === VentilationMode.SIMV && Number(params.psLevel) === 0)) {
            const V_target = Number(params.volume);
            const Pplat_calc = Number(params.peep) + (V_target / patientCompliance);
            const peakInspFlowLPS = Tif > 0 ? (V_target / 1000) / (Tif / 1000) : 0;
            const Ppeak_calc = Pplat_calc + (peakInspFlowLPS * patientResistance);
            newMonitoredParams.pPeak = Math.max(Number(params.peep), parseFloat(Ppeak_calc.toFixed(1)));
            newMonitoredParams.pPlateau = inspPausePercent > 0 ? Math.max(Number(params.peep), parseFloat(Pplat_calc.toFixed(1))) : t.valueNotAvailable;
        } else if (activeMode === VentilationMode.PC || activeMode === VentilationMode.PS || (activeMode === VentilationMode.SIMV && Number(params.psLevel) > 0)) {
            const drivingPressure = (activeMode === VentilationMode.PC || (activeMode === VentilationMode.SIMV && Number(params.psLevel) === 0)) ? Number(params.pressureTarget) : Number(params.psLevel);
            const Ppeak_calc = Number(params.peep) + drivingPressure;
            newMonitoredParams.pPeak = parseFloat(Ppeak_calc.toFixed(1));
            if (activeMode === VentilationMode.PC || (activeMode === VentilationMode.SIMV && Number(params.psLevel) === 0)) {
                newMonitoredParams.pPlateau = newMonitoredParams.pPeak;
            } else { // This is PS mode or SIMV with PS breaths
                newMonitoredParams.pPlateau = t.valueNotAvailable;
            }
        } else if (activeMode === VentilationMode.CPAP) {
            newMonitoredParams.pPeak = Number(params.peep) + (Math.random() * 2);
            newMonitoredParams.pPlateau = Number(params.peep);
        }

        newMonitoredParams.pMean = Math.max(Number(params.peep), parseFloat(((Number(newMonitoredParams.pPeak) + Number(params.peep)) / 2.2 + (Math.random() * 1 - 0.5)).toFixed(1)));

        let VTi_delivered = 0;
        if (activeMode === VentilationMode.VC || (activeMode === VentilationMode.SIMV && Number(params.volume) > 0 && Number(params.psLevel) === 0)) {
          VTi_delivered = Number(params.volume);
        } else if (activeMode === VentilationMode.PC || activeMode === VentilationMode.PS || (activeMode === VentilationMode.SIMV && ((Number(params.pressureTarget) > 0 && Number(params.psLevel) === 0) || Number(params.psLevel) > 0))) {
          const drivingPressure = (activeMode === VentilationMode.PC || (activeMode === VentilationMode.SIMV && Number(params.pressureTarget) > 0 && Number(params.psLevel) === 0)) ? Number(params.pressureTarget) : Number(params.psLevel);
          VTi_delivered = drivingPressure * patientCompliance * 0.9;
        } else if (activeMode === VentilationMode.CPAP && freqForMV > 0) {
             VTi_delivered = (5 + Math.random() * 5) * patientCompliance * 0.5;
        }

        newMonitoredParams.volumeInspired = Math.round(VTi_delivered);

        const isNivOrLeakyMode = (operatingMode === 'icu' && (icuSubMode === 'non-invasive' || icuSubMode === 'invasive') && activeMode !== VentilationMode.CPAP && activeMode !== VentilationMode.HIGH_FLOW);
        const currentSimulatedLeakFraction = isNivOrLeakyMode ? (Math.random() * 0.20 + 0.05) : 0;

        if (VTi_delivered > 0) {
          newMonitoredParams.volumeExpired = Math.max(0, Math.round(VTi_delivered * (1 - currentSimulatedLeakFraction)));
          newMonitoredParams.leakPercentage = parseFloat((currentSimulatedLeakFraction * 100).toFixed(1));
        } else {
          newMonitoredParams.volumeExpired = Math.round(Math.random() * 50);
          newMonitoredParams.leakPercentage = 0;
        }

        if (icuSubMode === 'high-flow' || (activeMode === VentilationMode.CPAP && VTi_delivered === 0)) {
            newMonitoredParams.volumeExpired = 0;
            newMonitoredParams.leakPercentage = 0;
        }

        if (activeMode !== VentilationMode.HIGH_FLOW) {
          if (freqForMV > 0 && Number(newMonitoredParams.volumeExpired) > 0) {
            newMonitoredParams.volumeMinute = parseFloat(((freqForMV * Number(newMonitoredParams.volumeExpired)) / 1000).toFixed(1));
          } else {
            newMonitoredParams.volumeMinute = 0;
          }
        } else {
          newMonitoredParams.volumeMinute = 0;
        }

        if (patientSettings.weight && patientSettings.weight > 0 && Number(newMonitoredParams.volumeExpired) > 0) {
          newMonitoredParams.mlPerKg = parseFloat((Number(newMonitoredParams.volumeExpired) / patientSettings.weight).toFixed(1));
        } else {
          newMonitoredParams.mlPerKg = patientSettings.weight ? 0 : '--';
        }

        if(operatingMode !== 'anesthesia'){
          newMonitoredParams.etco2 = Number(params.etco2) > 0 ? params.etco2 : 35;
          newMonitoredParams.spo2 = Number(params.spo2) > 0 ? params.spo2 : 98;
        } else {
          let etco2Change = (38 - Number(params.etco2)) * 0.1 + (Math.random() * 2 - 1);
          newMonitoredParams.etco2 = Math.min(60, Math.max(20, Number(params.etco2) + etco2Change));
          let spo2Change = (98 - Number(params.spo2)) * 0.1 + (Math.random() * 0.8 - 0.4);
          const totalAchievedMac = (Number(newMonitoredParams.etAgentConcentration)/GAS_CONFIG[selectedAnestheticGases[0]]?.mac || 0) + ( (selectedAnestheticGases[1] && Number(newMonitoredParams.etSecondaryAgentConcentration)/GAS_CONFIG[selectedAnestheticGases[1]]?.mac) || 0 );
          if (totalAchievedMac > 1.5) spo2Change -= 0.2;
          newMonitoredParams.spo2 = Math.min(100, Math.max(85, Number(params.spo2) + spo2Change));
          newMonitoredParams.etco2 = parseFloat(Number(newMonitoredParams.etco2).toFixed(0));
          newMonitoredParams.spo2 = parseFloat(Number(newMonitoredParams.spo2).toFixed(0));
        }
      }

      if (isO2FlushActive) {
        newMonitoredParams.fio2 = 100;
      }

      return newMonitoredParams;
  }, [operatingMode, currentMode, isAnesthesiaActive, anesthesiaStartTime, selectedAnestheticGases, agentLevels, isRefillingAgents, isReplacingSodaLime, isMechanicalVentilation, icuSubMode, isVentilationActive, isWarmingUpHF, humidifierSettings.isOn, humidifierSettings.temperature, activeManeuver, maneuverStartTime, heldVolumeInspired, capturedPpeakForResistance, capturedAvgInspFlowLPS, patientSettings.weight, isO2FlushActive, t, logSessionEvent]);

  useEffect(() => {
    if (isSimulatorOn && operatingMode && !currentPostScreenKey && !isSelfTestRunning && !isDisinfecting) {
      const intervalId = setInterval(() => {
        setParameters(params => updateSimulationState(params));
      }, 2000);
      return () => clearInterval(intervalId);
    }
  }, [isSimulatorOn, operatingMode, currentPostScreenKey, isSelfTestRunning, isDisinfecting, updateSimulationState]);


  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    if (isO2FlushActive && o2FlushTimerEnd) {
      const remainingTime = o2FlushTimerEnd - Date.now();
      if (remainingTime > 0) {
        timerId = setTimeout(() => {
          setIsO2FlushActive(false);
          setO2FlushTimerEnd(null);
          if (preFlushFio2 !== null) {
            setParameters(prev => ({ ...prev, fio2: preFlushFio2 }));
            setPreFlushFio2(null);
          }
        }, remainingTime);
      } else {
        setIsO2FlushActive(false);
        setO2FlushTimerEnd(null);
        if (preFlushFio2 !== null) {
          setParameters(prev => ({ ...prev, fio2: preFlushFio2 }));
          setPreFlushFio2(null);
        }
      }
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isO2FlushActive, o2FlushTimerEnd, preFlushFio2]);


  useEffect(() => {
    if (!isSimulatorOn || (!isVentilationActive && !isWarmingUpHF) || !operatingMode || activeManeuver || (operatingMode === 'anesthesia' && !isMechanicalVentilation) || currentPostScreenKey || isSelfTestRunning || isDisinfecting) {
      setActiveAlarms({});
      setHasActiveAlarmsState(false);
      return;
    }

    const currentParamsSnapshot = parameters;
    const newActiveAlarms: Partial<Record<AlarmParameterKey, boolean>> = {};

    (Object.keys(alarmSettings) as AlarmParameterKey[]).forEach(key => {
      const alarm = alarmSettings[key];
      if (alarm.isOn) {
        let valueToMonitor: number | undefined = undefined;

        if (key === 'pPeak') valueToMonitor = Number(currentParamsSnapshot.pPeak);
        else if (key === 'volumeMinute') valueToMonitor = Number(currentParamsSnapshot.volumeMinute);
        else if (key === 'etco2') valueToMonitor = Number(currentParamsSnapshot.etco2);
        else if (key === 'inspiratoryCo2') valueToMonitor = Number(currentParamsSnapshot.inspiratoryCo2);
        else if (key === 'fio2') valueToMonitor = Number(currentParamsSnapshot.fio2);
        else if (key === 'peep') valueToMonitor = Number(currentParamsSnapshot.peep);
        else if (key === 'frequency') valueToMonitor = Number(currentParamsSnapshot.frequency);
        else if (key === 'measuredFrequency') valueToMonitor = Number(currentParamsSnapshot.measuredFrequency);
        else if (key === 'leakPercentage') valueToMonitor = Number(currentParamsSnapshot.leakPercentage);
        else if (key === 'deliveredFlow' && operatingMode === 'icu' && icuSubMode === 'high-flow') {
          valueToMonitor = Number(currentParamsSnapshot.fgf);
        } else if (key === 'checkWater' && operatingMode === 'icu' && icuSubMode === 'high-flow') {
            if (Number(currentParamsSnapshot.waterLevelPercent) < HIGH_FLOW_WATER_LOW_THRESHOLD_PERCENT) {
                 newActiveAlarms[key] = true;
            }
        }


        if (valueToMonitor !== undefined) {
          let isViolated = false;
          if (alarm.low !== null && valueToMonitor < alarm.low) {
            // Disable low Ppeak alarm check in CPAP mode as it's not clinically relevant and causes nuisance alarms
            if (!(currentMode === VentilationMode.CPAP && key === 'pPeak')) {
                 isViolated = true;
            }
          }
          if (alarm.high !== null && valueToMonitor > alarm.high) isViolated = true;
          if (isViolated) newActiveAlarms[key] = true;
        }
      }
    });
    
    // Log newly fired alarms
    const previouslyActiveKeys = Object.keys(activeAlarms).filter(k => activeAlarms[k as AlarmParameterKey]);
    const newlyActiveKeys = Object.keys(newActiveAlarms).filter(k => newActiveAlarms[k as AlarmParameterKey]);

    newlyActiveKeys.forEach(key => {
        if (!previouslyActiveKeys.includes(key)) {
            const alarmKey = key as AlarmParameterKey;
            const alarmConfig = ALARMABLE_PARAMETERS_CONFIG[alarmKey];
            const alarmLabel = alarmConfig ? t[alarmConfig.labelKey] : alarmKey;
            logSessionEvent('record_log_alarm_fired', alarmLabel);
        }
    });
    
    setActiveAlarms(newActiveAlarms);
    setHasActiveAlarmsState(Object.values(newActiveAlarms).some(isActive => isActive));

  }, [parameters, alarmSettings, isSimulatorOn, isVentilationActive, isWarmingUpHF, operatingMode, icuSubMode, activeManeuver, isMechanicalVentilation, currentPostScreenKey, isSelfTestRunning, isDisinfecting, activeAlarms, currentMode, logSessionEvent, t]);

  const resetSnoozeState = useCallback(() => {
    setIsAlarmSnoozed(false);
    if (snoozeTimeoutId.current) {
        clearTimeout(snoozeTimeoutId.current);
        snoozeTimeoutId.current = null;
    }
    if (snoozeDisplayIntervalIdRef.current) {
      clearInterval(snoozeDisplayIntervalIdRef.current);
      snoozeDisplayIntervalIdRef.current = null;
    }
    setSnoozeCountdownDisplay(null);
  }, []);

  const handleToggleAlarmSnooze = useCallback(() => {
    if (!isAlarmSnoozed) { // About to SNOOZE
        setIsAlarmSnoozed(true);
        setSnoozeCountdownDisplay(SNOOZE_DURATION_MS / 1000);
        logSessionEvent('record_log_alarm_snoozed');

        if (snoozeTimeoutId.current) clearTimeout(snoozeTimeoutId.current);
        snoozeTimeoutId.current = window.setTimeout(() => {
            setIsAlarmSnoozed(false);
            snoozeTimeoutId.current = null;
            setSnoozeCountdownDisplay(null);
            if (snoozeDisplayIntervalIdRef.current) {
                clearInterval(snoozeDisplayIntervalIdRef.current);
                snoozeDisplayIntervalIdRef.current = null;
            }
            logSessionEvent('record_log_alarm_unsnoozed', 'Timer expired');
        }, SNOOZE_DURATION_MS);

        if (snoozeDisplayIntervalIdRef.current) clearInterval(snoozeDisplayIntervalIdRef.current);
        snoozeDisplayIntervalIdRef.current = window.setInterval(() => {
            setSnoozeCountdownDisplay(prev => {
                if (prev === null || prev <= 1) {
                    if (snoozeDisplayIntervalIdRef.current) clearInterval(snoozeDisplayIntervalIdRef.current);
                    snoozeDisplayIntervalIdRef.current = null;
                    // The main timeout will handle setting snoozeCountdownDisplay to null eventually.
                    // Setting to 0 here indicates the countdown reached its end for display purposes.
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

    } else { // About to UN-SNOOZE manually
        resetSnoozeState(); 
        logSessionEvent('record_log_alarm_unsnoozed', 'Manual');
    }
  }, [isAlarmSnoozed, resetSnoozeState, logSessionEvent]);


  const runSelfTestSimulation = useCallback(async (postKeyToTest: PostScreenKey) => {
    setIsSelfTestRunning(true);

    let itemsToTest: Omit<SelfTestItem, 'status'>[];
    if (postKeyToTest === 'anesthesia_post') {
      itemsToTest = ANESTHESIA_POST_SELF_TEST_ITEMS;
    } else if (postKeyToTest === 'icu_general_post' || postKeyToTest === 'icu_invasive_post' || postKeyToTest === 'icu_noninvasive_post') {
      itemsToTest = VENTILATOR_POST_SELF_TEST_ITEMS;
    } else if (postKeyToTest === 'high_flow_post'){
      itemsToTest = POST_SCREEN_CONFIG.high_flow_post?.testItems || DEFAULT_SELF_TEST_ITEMS;
    }
     else {
      itemsToTest = DEFAULT_SELF_TEST_ITEMS;
    }

    let currentTestItems = itemsToTest.map(item => ({ ...item, status: 'pending' as 'pending' | 'succeeded' | 'failed' | 'running' }));
    setSelfTestProgressItems([...currentTestItems]);

    for (let i = 0; i < currentTestItems.length; i++) {
      currentTestItems[i].status = 'running';
      setSelfTestProgressItems([...currentTestItems]);
      await new Promise(resolve => setTimeout(resolve, SELF_TEST_ITEM_DURATION_MS));
      currentTestItems[i].status = 'succeeded';
      setSelfTestProgressItems([...currentTestItems]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const currentTimeISO = new Date().toISOString();
    setLastSelfTestResults(prev => ({ ...prev, [postKeyToTest]: currentTimeISO }));
    setSimulatorSettings(prevSimSettings => {
        const newGeneralSettings = { ...prevSimSettings.general };
        if (!newGeneralSettings[postKeyToTest]) {
            newGeneralSettings[postKeyToTest] = { performed: false, dateTime: null };
        }
        (newGeneralSettings[postKeyToTest] as any).performed = true;
        (newGeneralSettings[postKeyToTest] as any).dateTime = currentTimeISO;
        return { ...prevSimSettings, general: newGeneralSettings };
    });
    setIsSelfTestRunning(false);
  }, []);

  const handlePerformSelfTest = useCallback((postKeyToTest: PostScreenKey) => {
    runSelfTestSimulation(postKeyToTest);
  }, [runSelfTestSimulation]);

  const handleStartDisinfectionCycle = useCallback(async (postKeyToDisinfect: PostScreenKey) => {
    if (postKeyToDisinfect !== 'high_flow_post') return;

    setIsDisinfecting(true);
    const item: SelfTestItem = { nameKey: 'disinfection_cycle_running', status: 'pending' };
    setDisinfectionProgressItem({...item});

    await new Promise(resolve => setTimeout(resolve, 50));

    item.status = 'running';
    setDisinfectionProgressItem({...item});

    const DISINFECTION_DURATION_MS = 15000;
    await new Promise(resolve => setTimeout(resolve, DISINFECTION_DURATION_MS));

    item.status = 'succeeded';
    setDisinfectionProgressItem({...item});

    await new Promise(resolve => setTimeout(resolve, 500));

    const currentTimeISO = new Date().toISOString();
    setSimulatorSettings(prevSimSettings => {
        const newGeneralSettings = { ...prevSimSettings.general };
        if (newGeneralSettings.high_flow_post) {
            newGeneralSettings.high_flow_post.lastDisinfectionStatus = 'clean';
            newGeneralSettings.high_flow_post.dateTime = currentTimeISO;
            newGeneralSettings.high_flow_post.performed = true;
        }
        return { ...prevSimSettings, general: newGeneralSettings };
    });
    setLastSelfTestResults(prev => ({ ...prev, [postKeyToDisinfect]: currentTimeISO }));


    setIsDisinfecting(false);
    setDisinfectionProgressItem(null);
  }, []);

  const setupHighFlowMode = useCallback((patientData: PatientSettings, interfaceType: HighFlowInterfaceType) => {
    setPatientSettings(patientData); // Set the default patient data
    setIsSimulatorOn(true);
    setIsVentilationActive(false);
    setIsWarmingUpHF(false);
    setOperatingMode('icu');
    setIcuSubMode('high-flow');
    setCurrentMode(VentilationMode.HIGH_FLOW);
    setIsMechanicalVentilation(true);
    logSessionEvent('record_log_icuSubMode_selected', { subMode: 'high-flow', interface: interfaceType });
    hfTempRampRef.current = null;

    const initialFGF = interfaceType === 'adult' ? simulatorSettings.highFlow.defaultFGFAdult : simulatorSettings.highFlow.defaultFGFJunior;
    let initialTemp = interfaceType === 'adult' ? simulatorSettings.highFlow.defaultTempAdult : simulatorSettings.highFlow.defaultFGFJunior;
    if (interfaceType === 'junior' && initialTemp > HIGH_FLOW_TEMP_MAX_JUNIOR) {
        initialTemp = HIGH_FLOW_TEMP_MAX_JUNIOR;
    }

    setParameters(prev => ({
      ...INITIAL_PARAMETERS,
      isMechanicalVentilation: 1,
      ...simulatorSettings.patientProfile,
      fgf: initialFGF,
      fio2: simulatorSettings.highFlow.defaultFio2HighFlow, // Use HF specific FiO2 default
      temperature: initialTemp,
      deliveredTemperature: AMBIENT_TEMPERATURE,
      humidifierTemperature: initialTemp,
      peep: 0,
      mlPerKg: patientData.weight ? 0 : '--',
      sodaLimeRemainingPercent: INITIAL_PARAMETERS.sodaLimeRemainingPercent,
      targetMac: 0,
      waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
      lastDisinfectionStatus: simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean',
      highFlowInterfaceType: interfaceType,
    }));

    const initialAgentLvls: AgentLevels = {} as AgentLevels;
    ANESTHETIC_GAS_ORDER.forEach(gas => initialAgentLvls[gas] = 100);
    setAgentLevels(initialAgentLvls);
    setSelectedAnestheticGases([]);

    setIsAnesthesiaActive(false);
    setAnesthesiaStartTime(null);
    setActiveManeuver(null);
    setAreWaveformsFrozen(false);
    setManeuverResultsPackage(null);
    setIsO2FlushActive(false);
    resetSnoozeState();

    if (simulatorSettings.general.resetAlarmsOnNewPatient) {
        const newAlarmSettings = JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS));
        if (interfaceType === 'junior') {
            newAlarmSettings.deliveredFlow.high = HIGH_FLOW_PEDIATRIC_FGF_MAX_CONSTANT;
        }
        setAlarmSettings(newAlarmSettings);
    }
  }, [simulatorSettings, logSessionEvent, resetSnoozeState]);


  const handleConfirmPatientDataAndProceed = useCallback((newPatientSettings: PatientSettings) => {
    setPatientSettings(newPatientSettings);
    logSessionEvent('record_log_patient_data_confirmed', newPatientSettings);
    const opModeToProceed = patientDataModalInfo.pendingOperatingMode;
    const subModeForDirectSetup = patientDataModalInfo.pendingIcuSubModeForSetup;
    const hfInterfaceForDirectSetup = patientDataModalInfo.pendingHighFlowInterfaceForSetup;

    setPatientDataModalInfo({ isOpen: false, pendingOperatingMode: null, pendingIcuSubModeForSetup: null, pendingHighFlowInterfaceForSetup: null });

    if (opModeToProceed) {
        if (opModeToProceed === 'icu' && subModeForDirectSetup === 'high-flow' && hfInterfaceForDirectSetup) {
            setupHighFlowMode(newPatientSettings, hfInterfaceForDirectSetup);
            return;
        }

        setIsSimulatorOn(true);
        setIsVentilationActive(false);
        setIsWarmingUpHF(false);
        setOperatingMode(opModeToProceed);
        hfTempRampRef.current = null; // Clear HF ramp state on mode proceed

        const baseParams: AllParameters = {
            ...INITIAL_PARAMETERS,
            ...simulatorSettings.patientProfile,
            sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
            fio2: (opModeToProceed === 'icu' && subModeForDirectSetup === 'high-flow')
                  ? simulatorSettings.highFlow.defaultFio2HighFlow
                  : simulatorSettings.ventilationDefaults.defaultInitialFio2,
            humidifierTemperature: humidifierSettings.temperature,
            deliveredTemperature: AMBIENT_TEMPERATURE,
            mlPerKg: newPatientSettings.weight && Number(INITIAL_PARAMETERS.volumeExpired) > 0 ? parseFloat((Number(INITIAL_PARAMETERS.volumeExpired) / newPatientSettings.weight).toFixed(1)) : (newPatientSettings.weight ? 0 : '--'),
            waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
            lastDisinfectionStatus: opModeToProceed === 'icu' && subModeForDirectSetup === 'high-flow'
                ? simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean'
                : null,
            highFlowInterfaceType: (opModeToProceed === 'icu' && subModeForDirectSetup === 'high-flow' && hfInterfaceForDirectSetup) ? hfInterfaceForDirectSetup : INITIAL_PARAMETERS.highFlowInterfaceType,
            temperature: (opModeToProceed === 'icu' && subModeForDirectSetup === 'high-flow' && hfInterfaceForDirectSetup)
                         ? (hfInterfaceForDirectSetup === 'junior' ? simulatorSettings.highFlow.defaultTempJunior : simulatorSettings.highFlow.defaultTempAdult)
                         : simulatorSettings.general.humidifierDefaultTemp,
        };

        const initialAgentLvls: AgentLevels = {} as AgentLevels;
        ANESTHETIC_GAS_ORDER.forEach(gas => initialAgentLvls[gas] = 100);
        simulatorSettings.anesthesia.vaporizers.forEach(vap => {
            if (initialAgentLvls.hasOwnProperty(vap.gas)) {
                initialAgentLvls[vap.gas] = vap.level;
            }
        });
        setAgentLevels(initialAgentLvls);
        setSelectedAnestheticGases(
            simulatorSettings.anesthesia.vaporizers.length > 0 && opModeToProceed === 'anesthesia'
            ? [simulatorSettings.anesthesia.vaporizers[0].gas]
            : (ANESTHETIC_GAS_ORDER[0] && opModeToProceed === 'anesthesia' ? [ANESTHETIC_GAS_ORDER[0]] : [])
        );

        let newMode: VentilationMode;
        if (opModeToProceed === 'anesthesia') {
            setIcuSubMode(null);
            newMode = simulatorSettings.ventilationDefaults.defaultModeAnesthesiaMechanical;
            setCurrentMode(newMode);
            setIsMechanicalVentilation(false);
            const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(newMode, baseParams.frequency, baseParams.psLevel, baseParams.spontaneousRate);
            setParameters({...baseParams,
                isMechanicalVentilation: 0,
                fgf: simulatorSettings.anesthesia.defaultFGF,
                peep: simulatorSettings.anesthesia.defaultAPL,
                targetMac: simulatorSettings.anesthesia.defaultTargetMAC,
                measuredFrequency,
                spontaneousRate,
            });
        } else if (opModeToProceed === 'icu') {
            setIsMechanicalVentilation(true);
             const icuBaseParams: Partial<AllParameters> = {
                isMechanicalVentilation: 1,
                peep: simulatorSettings.ventilationDefaults.defaultInitialPeep,
                targetMac: 0,
            };
            if (subModeForDirectSetup !== 'high-flow') {
                 (icuBaseParams as AllParameters).fgf = INITIAL_PARAMETERS.fgf;
            }

            if (subModeForDirectSetup === 'invasive') {
                setIcuSubMode('invasive');
                logSessionEvent('record_log_icuSubMode_selected', { subMode: 'invasive' });
                newMode = simulatorSettings.ventilationDefaults.defaultModeICUInvasive;
            } else if (subModeForDirectSetup === 'non-invasive') {
                 setIcuSubMode('non-invasive');
                 logSessionEvent('record_log_icuSubMode_selected', { subMode: 'non-invasive' });
                 newMode = simulatorSettings.ventilationDefaults.defaultModeICUNonInvasive;
            } else { // Fallback if not HF and not specified
                setIcuSubMode('invasive');
                newMode = simulatorSettings.ventilationDefaults.defaultModeICUInvasive;
            }
            setCurrentMode(newMode);
            const finalParams = {...baseParams, ...icuBaseParams};
            const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(newMode, finalParams.frequency, finalParams.psLevel, finalParams.spontaneousRate);
            setParameters({...finalParams, measuredFrequency, spontaneousRate} as AllParameters);
        }
        setIsAnesthesiaActive(false);
        setAnesthesiaStartTime(null);
        setActiveManeuver(null);
        setAreWaveformsFrozen(false);
        setManeuverResultsPackage(null);
        setIsO2FlushActive(false);
        resetSnoozeState();

        if (simulatorSettings.general.resetAlarmsOnNewPatient) {
            setAlarmSettings(JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS)));
        }
    }
  }, [patientDataModalInfo, simulatorSettings, humidifierSettings, logSessionEvent, setupHighFlowMode, resetSnoozeState]);

  const downloadSessionLog = useCallback(() => {
    if (sessionLog.length > 0) {
        const logContent = `${t.record_log_header}\n\n${sessionLog.join('\n')}`;
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `openventsim_session_log_${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  }, [sessionLog, t]);

  const handlePowerOff = useCallback(() => {
    if (isSessionActiveRecordingRef.current) {
        logSessionEvent('record_log_session_ended', "POWER OFF");
        downloadSessionLog();
    }
    setIsRecordingEnabledForNextSession(false);
    setIsSessionActiveRecording(false);
    setSessionLog([]);
    setSessionStartTime(null);

    setIsSimulatorOn(false);
    setIsVentilationActive(false);
    setIsWarmingUpHF(false);
    setOperatingMode(null);
    setIcuSubMode(null);
    setIsAnesthesiaActive(false);
    setAnesthesiaStartTime(null);
    setCurrentMode(simulatorSettings.ventilationDefaults.defaultModeICUInvasive);
    setActiveManeuver(null);
    setAreWaveformsFrozen(false);
    setManeuverResultsPackage(null);
    setPatientDataModalInfo({ isOpen: false, pendingOperatingMode: null, pendingIcuSubModeForSetup: null, pendingHighFlowInterfaceForSetup: null });
    setIsMechanicalVentilation(false);
    hfTempRampRef.current = null; // Clear HF ramp state on power off


    setPatientSettings({
        age: simulatorSettings.patientProfile.age,
        gender: simulatorSettings.patientProfile.gender,
        weight: simulatorSettings.patientProfile.weight,
    });
     setHumidifierSettings({
        isOn: simulatorSettings.general.humidifierDefaultOn,
        temperature: simulatorSettings.general.humidifierDefaultTemp,
    });

    const initialAgentLvls: AgentLevels = {} as AgentLevels;
    ANESTHETIC_GAS_ORDER.forEach(gas => initialAgentLvls[gas] = 100);
    simulatorSettings.anesthesia.vaporizers.forEach(vap => {
        if (initialAgentLvls.hasOwnProperty(vap.gas)) {
            initialAgentLvls[vap.gas] = vap.level;
        }
    });
    setAgentLevels(initialAgentLvls);
    setSelectedAnestheticGases(
        simulatorSettings.anesthesia.vaporizers.length > 0
        ? [simulatorSettings.anesthesia.vaporizers[0].gas]
        : (ANESTHETIC_GAS_ORDER[0] ? [ANESTHETIC_GAS_ORDER[0]] : [])
    );

    setParameters(prev => ({
        ...INITIAL_PARAMETERS,
        ...simulatorSettings.patientProfile,
        isMechanicalVentilation: 0,
        sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
        fgf: simulatorSettings.anesthesia.defaultFGF,
        peep: simulatorSettings.anesthesia.defaultAPL,
        fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2,
        targetMac: simulatorSettings.anesthesia.defaultTargetMAC,
        temperature: simulatorSettings.highFlow.defaultTempAdult,
        deliveredTemperature: AMBIENT_TEMPERATURE,
        humidifierTemperature: simulatorSettings.general.humidifierDefaultTemp,
        waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
        lastDisinfectionStatus: simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean',
        highFlowInterfaceType: simulatorSettings.highFlow.interfaceType || 'adult',
        mlPerKg: simulatorSettings.patientProfile.weight && Number(INITIAL_PARAMETERS.volumeExpired) > 0 ? parseFloat((Number(INITIAL_PARAMETERS.volumeExpired) / simulatorSettings.patientProfile.weight).toFixed(1)) : (simulatorSettings.patientProfile.weight ? 0 : '--'),
    }));

    setIsO2FlushActive(false);
    setCurrentPostScreenKey(null);
    setIsSelfTestRunning(false);
    setSelfTestProgressItems([]);
    setSelectedIcuSubModeOnPostScreen('invasive');
    resetSnoozeState();

    if (simulatorSettings.general.resetAlarmsOnNewPatient) {
        setAlarmSettings(JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS)));
    }
  }, [simulatorSettings, downloadSessionLog, logSessionEvent, t, resetSnoozeState]);


 const handleModeSelectionFromStartup = useCallback((opMode: OperatingMode, subMode?: ICUSubMode) => {
    const startTime = Date.now();
    setSessionStartTime(startTime);

    let postKey: PostScreenKey | null = null;
    if (opMode === 'anesthesia') {
        postKey = 'anesthesia_post';
    } else if (opMode === 'icu') {
        if (subMode === 'high-flow') {
            postKey = 'high_flow_post';
        } else {
            postKey = 'icu_general_post';
             setSelectedIcuSubModeOnPostScreen(subMode || 'invasive');
        }
    }

    if (isRecordingEnabledForNextSession) {
        setIsSessionActiveRecording(true);
        setSessionLog([`T+0.0s - ${t.record_log_session_started}`]);
    } else {
        setIsSessionActiveRecording(false);
        setSessionLog([]);
    }
    logSessionEvent('record_log_opMode_selected', { opMode, subMode: subMode || 'N/A' });
    hfTempRampRef.current = null;


    setPatientSettings({
        age: simulatorSettings.patientProfile.age,
        gender: simulatorSettings.patientProfile.gender,
        weight: simulatorSettings.patientProfile.weight,
    });
    setHumidifierSettings({
        isOn: simulatorSettings.general.humidifierDefaultOn,
        temperature: simulatorSettings.general.humidifierDefaultTemp,
    });

    const initialAgentLvls: AgentLevels = {} as AgentLevels;
    ANESTHETIC_GAS_ORDER.forEach(gas => initialAgentLvls[gas] = 100);
    simulatorSettings.anesthesia.vaporizers.forEach(vap => {
        if (initialAgentLvls.hasOwnProperty(vap.gas)) {
            initialAgentLvls[vap.gas] = vap.level;
        }
    });
    setAgentLevels(initialAgentLvls);
    setSelectedAnestheticGases(
        simulatorSettings.anesthesia.vaporizers.length > 0
        ? [simulatorSettings.anesthesia.vaporizers[0].gas]
        : (ANESTHETIC_GAS_ORDER[0] ? [ANESTHETIC_GAS_ORDER[0]] : [])
    );

    const baseParamsForStartup: AllParameters = {
        ...INITIAL_PARAMETERS,
        ...simulatorSettings.patientProfile,
        sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
        fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2, // Default, will be overridden for HF
        humidifierTemperature: simulatorSettings.general.humidifierDefaultTemp,
        deliveredTemperature: AMBIENT_TEMPERATURE,
        waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
        lastDisinfectionStatus: simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean',
        highFlowInterfaceType: simulatorSettings.highFlow.interfaceType || 'adult',
        temperature: simulatorSettings.highFlow.defaultTempAdult,
    };

    if (opMode === 'anesthesia') {
        baseParamsForStartup.fgf = simulatorSettings.anesthesia.defaultFGF;
        baseParamsForStartup.peep = simulatorSettings.anesthesia.defaultAPL;
        baseParamsForStartup.targetMac = simulatorSettings.anesthesia.defaultTargetMAC;
        baseParamsForStartup.isMechanicalVentilation = 0; // Start in Bag-Mask
    } else { // ICU modes
        baseParamsForStartup.peep = simulatorSettings.ventilationDefaults.defaultInitialPeep;
        baseParamsForStartup.isMechanicalVentilation = 1;
        baseParamsForStartup.targetMac = 0;
        if (subMode === 'high-flow') {
           const initialInterface = POST_SCREEN_CONFIG.high_flow_post.initialHighFlowInterfaceType || 'adult';
           baseParamsForStartup.highFlowInterfaceType = initialInterface;
           baseParamsForStartup.fgf = initialInterface === 'adult' ? simulatorSettings.highFlow.defaultFGFAdult : simulatorSettings.highFlow.defaultFGFJunior;
           baseParamsForStartup.temperature = initialInterface === 'adult' ? simulatorSettings.highFlow.defaultTempAdult : simulatorSettings.highFlow.defaultTempJunior;
           baseParamsForStartup.fio2 = simulatorSettings.highFlow.defaultFio2HighFlow; // HF specific FiO2
        } else {
            baseParamsForStartup.fgf = INITIAL_PARAMETERS.fgf;
            baseParamsForStartup.fio2 = simulatorSettings.ventilationDefaults.defaultInitialFio2; // General ICU FiO2
        }
    }
    setParameters(baseParamsForStartup);
    resetSnoozeState();

    if (simulatorSettings.general.resetAlarmsOnNewPatient) {
        const newAlarmSettings = JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS));
        if (opMode === 'icu' && subMode === 'high-flow') {
            const initialInterface = POST_SCREEN_CONFIG.high_flow_post.initialHighFlowInterfaceType || 'adult';
            if (initialInterface === 'junior') {
                newAlarmSettings.deliveredFlow.high = HIGH_FLOW_PEDIATRIC_FGF_MAX_CONSTANT;
            }
        }
        setAlarmSettings(newAlarmSettings);
    }


    setCurrentPostScreenKey(postKey);
  }, [simulatorSettings, isRecordingEnabledForNextSession, t, logSessionEvent, resetSnoozeState]);


  const handleICUSubModeSelectionFromScreenInternal = useCallback((subMode: ICUSubMode) => {
    let postKey: PostScreenKey | null = null;
    if (subMode === 'invasive') {
        postKey = 'icu_invasive_post';
    } else if (subMode === 'non-invasive') {
        postKey = 'icu_noninvasive_post';
    }
    logSessionEvent('record_log_icuSubMode_selected', { subMode });
    setCurrentPostScreenKey(postKey);
  }, [logSessionEvent]);

  const handleSelectIcuSubModeOnPostScreen = useCallback((subMode: ICUSubMode) => {
    setSelectedIcuSubModeOnPostScreen(subMode);
  }, []);


  const handleProceedFromPostScreen = useCallback((postKeyCompleted: PostScreenKey, selectedInterface?: HighFlowInterfaceType) => {
    const config = POST_SCREEN_CONFIG[postKeyCompleted];
    setCurrentPostScreenKey(null);
    hfTempRampRef.current = null;
    resetSnoozeState();

    const defaultPatientProfileFromSettings = {
        age: simulatorSettings.patientProfile.age,
        gender: simulatorSettings.patientProfile.gender,
        weight: simulatorSettings.patientProfile.weight,
    };

    if (postKeyCompleted === 'high_flow_post' && selectedInterface) {
        // For HF, interface is selected on PostScreen, then proceed DIRECTLY.
        logSessionEvent('record_log_patient_data_confirmed', defaultPatientProfileFromSettings); // Log using default data
        setupHighFlowMode(defaultPatientProfileFromSettings, selectedInterface);
    } else if (config.proceedsTo === 'patient_data') {
        setPatientDataModalInfo({
            isOpen: true,
            pendingOperatingMode: config.initialOperatingMode || null,
            pendingIcuSubModeForSetup: config.initialIcuSubMode || null,
            pendingHighFlowInterfaceForSetup: config.initialHighFlowInterfaceType || null,
            overrideTitle: 'patientDataPromptTitle'
        });
    } else if (config.proceedsTo === 'icu_sub_selection') {
        const subModeForSetup = selectedIcuSubModeOnPostScreen;
        logSessionEvent('record_log_icuSubMode_selected', { subMode: subModeForSetup, fromScreen: 'icu_general_post_startup_proceed' });
        setPatientDataModalInfo({
            isOpen: true,
            pendingOperatingMode: config.initialOperatingMode,
            pendingIcuSubModeForSetup: subModeForSetup,
            overrideTitle: 'patientDataPromptTitle'
        });
    } else if (config.proceedsTo === 'icu_invasive_interface' || config.proceedsTo === 'icu_noninvasive_interface') {
        setPatientSettings(defaultPatientProfileFromSettings);
        setOperatingMode('icu');
        const subMode = config.initialIcuSubMode!;
        setIcuSubMode(subMode);
        logSessionEvent('record_log_icuSubMode_selected', { subMode });
        setCurrentMode(subMode === 'invasive' ? simulatorSettings.ventilationDefaults.defaultModeICUInvasive : simulatorSettings.ventilationDefaults.defaultModeICUNonInvasive);
        setIsMechanicalVentilation(true);
        setIsSimulatorOn(true);
        setIsVentilationActive(false);
        setIsWarmingUpHF(false);
        setParameters(prev => ({
            ...INITIAL_PARAMETERS,
            ...simulatorSettings.patientProfile,
            isMechanicalVentilation: 1,
            peep: simulatorSettings.ventilationDefaults.defaultInitialPeep,
            fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2, // General ICU default
            targetMac: 0,
            temperature: INITIAL_PARAMETERS.temperature,
            deliveredTemperature: AMBIENT_TEMPERATURE,
            humidifierTemperature: simulatorSettings.general.humidifierDefaultTemp,
            highFlowInterfaceType: null, // Not HF path
            mlPerKg: defaultPatientProfileFromSettings.weight && Number(INITIAL_PARAMETERS.volumeInspired) > 0 ? parseFloat((Number(INITIAL_PARAMETERS.volumeInspired) / defaultPatientProfileFromSettings.weight).toFixed(1)) : (defaultPatientProfileFromSettings.weight ? 0 : '--')
        }));
        if (simulatorSettings.general.resetAlarmsOnNewPatient) {
            setAlarmSettings(JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS)));
        }
    }
  }, [selectedIcuSubModeOnPostScreen, simulatorSettings, logSessionEvent, setupHighFlowMode, resetSnoozeState]);


  const handleBackFromPostScreen = useCallback(() => {
    if (currentPostScreenKey) {
        const postKey = currentPostScreenKey;
        setCurrentPostScreenKey(null);
        hfTempRampRef.current = null;
        resetSnoozeState();

        if (postKey === 'anesthesia_post' || postKey === 'icu_general_post' || postKey === 'high_flow_post') {
            handlePowerOff();
        } else if (postKey === 'icu_invasive_post' || postKey === 'icu_noninvasive_post') {
            setCurrentPostScreenKey('icu_general_post');
            setSelectedIcuSubModeOnPostScreen(postKey === 'icu_invasive_post' ? 'invasive' : 'non-invasive');
            setOperatingMode('icu');
            setIcuSubMode(null);

            setParameters(prev => {
                const baseParams: AllParameters = {
                    ...INITIAL_PARAMETERS,
                    ...simulatorSettings.patientProfile,
                    isMechanicalVentilation: 1,
                    sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
                    fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2,
                    peep: simulatorSettings.ventilationDefaults.defaultInitialPeep,
                    humidifierTemperature: humidifierSettings.temperature,
                    temperature: simulatorSettings.general.humidifierDefaultTemp,
                    deliveredTemperature: AMBIENT_TEMPERATURE,
                    targetMac: 0,
                    waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
                    lastDisinfectionStatus: null,
                    highFlowInterfaceType: null,
                };
                 if (patientSettings.weight && Number(baseParams.volumeExpired) > 0) {
                     baseParams.mlPerKg = parseFloat((Number(baseParams.volumeExpired) / patientSettings.weight).toFixed(1));
                } else {
                     baseParams.mlPerKg = patientSettings.weight ? 0 : '--';
                }
                return baseParams;
            });
        }
    }
  }, [currentPostScreenKey, handlePowerOff, patientSettings.weight, simulatorSettings, humidifierSettings, resetSnoozeState]);


  const handleClosePatientDataModal = useCallback(() => {
    const wasInStartupFlow = patientDataModalInfo.pendingOperatingMode !== null;
    let fromPostKey: PostScreenKey | null = null;

    if (patientDataModalInfo.pendingOperatingMode === 'anesthesia') {
        fromPostKey = 'anesthesia_post';
    } else if (patientDataModalInfo.pendingOperatingMode === 'icu') {
        if (patientDataModalInfo.pendingIcuSubModeForSetup === 'high-flow') {
            // This case should be less frequent now for initial HF setup,
            // as it proceeds directly. But if modal was opened for other reasons.
            fromPostKey = 'high_flow_post';
        } else if (patientDataModalInfo.pendingIcuSubModeForSetup === 'invasive' || patientDataModalInfo.pendingIcuSubModeForSetup === 'non-invasive') {
            fromPostKey = 'icu_general_post';
        } else {
            fromPostKey = 'icu_general_post'; 
        }
    }


    setPatientDataModalInfo({ isOpen: false, pendingOperatingMode: null, pendingIcuSubModeForSetup: null, pendingHighFlowInterfaceForSetup: null });

    if (wasInStartupFlow && !operatingMode && fromPostKey) {
      setCurrentPostScreenKey(fromPostKey as PostScreenKey);
      if (fromPostKey === 'icu_general_post' && patientDataModalInfo.pendingIcuSubModeForSetup && patientDataModalInfo.pendingIcuSubModeForSetup !== 'high-flow') {
        setSelectedIcuSubModeOnPostScreen(patientDataModalInfo.pendingIcuSubModeForSetup);
      }
    } else if (wasInStartupFlow && !operatingMode) {
        handlePowerOff();
    }
  }, [patientDataModalInfo, operatingMode, handlePowerOff]);


  const handleSelectICUSubMode = useCallback((subMode: ICUSubMode) => {
    logSessionEvent('record_log_icuSubMode_selected', { subMode });
    if (subMode === 'invasive') {
        setCurrentPostScreenKey('icu_invasive_post');
    } else if (subMode === 'non-invasive') {
        setCurrentPostScreenKey('icu_noninvasive_post');
    }
  }, [logSessionEvent]);


  const handleBackToICUSubModeSelection = useCallback(() => {
    if (operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive')) {
      const previousSubMode = icuSubMode;

      setCurrentPostScreenKey('icu_general_post');
      setSelectedIcuSubModeOnPostScreen(previousSubMode);
      setIcuSubMode(null);
      setIsVentilationActive(false);
      setIsWarmingUpHF(false);
      hfTempRampRef.current = null;
      resetSnoozeState();

      setParameters(prev => {
          const baseParams: AllParameters = {
              ...INITIAL_PARAMETERS,
              ...simulatorSettings.patientProfile,
              isMechanicalVentilation: 1,
              sodaLimeRemainingPercent: simulatorSettings.anesthesia.sodaLimeRemainingPercent,
              fio2: simulatorSettings.ventilationDefaults.defaultInitialFio2,
              peep: simulatorSettings.ventilationDefaults.defaultInitialPeep,
              humidifierTemperature: humidifierSettings.temperature,
              temperature: simulatorSettings.general.humidifierDefaultTemp,
              deliveredTemperature: AMBIENT_TEMPERATURE,
              targetMac: 0,
              waterLevelPercent: simulatorSettings.highFlow.initialWaterLevelPercent,
              lastDisinfectionStatus: null,
              highFlowInterfaceType: null, // Not in HF mode
          };
           if (patientSettings.weight && patientSettings.weight > 0 && Number(baseParams.volumeInspired) > 0) {
              baseParams.mlPerKg = parseFloat((Number(baseParams.volumeInspired) / patientSettings.weight).toFixed(1));
          } else {
              baseParams.mlPerKg = patientSettings.weight ? 0 : '--';
          }
          return baseParams;
      });

      setAreWaveformsFrozen(false);
      setActiveManeuver(null);
      setManeuverResultsPackage(null);
    }
  }, [operatingMode, icuSubMode, patientSettings.weight, simulatorSettings, humidifierSettings, resetSnoozeState]);


  const handleToggleVentilation = useCallback(() => {
    if (operatingMode === 'icu' && icuSubMode === 'high-flow') {
        if (isWarmingUpHF || isVentilationActive) {
            setIsWarmingUpHF(false);
            setIsVentilationActive(false);
            hfTempRampRef.current = null; // Clear ramp on stop
            logSessionEvent('record_log_ventilation_stopped');
        } else {
            setIsWarmingUpHF(true);
            setIsVentilationActive(false);
            // Ramp will be initiated by the useEffect watching isWarmingUpHF
        }
    } else {
        const newVentState = !isVentilationActive;
        setIsVentilationActive(newVentState);
        if (newVentState) {
            logSessionEvent('record_log_ventilation_started');
            const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(currentMode, parameters.frequency, parameters.psLevel, parameters.spontaneousRate);
            setParameters(prev => updateSimulationState({...prev, measuredFrequency, spontaneousRate}));
            setActiveManeuver(null);
            setManeuverStartTime(null);
            setManeuverResultsPackage(null);
        } else {
            logSessionEvent('record_log_ventilation_stopped');
        }
    }
  }, [operatingMode, icuSubMode, isWarmingUpHF, isVentilationActive, logSessionEvent, currentMode, parameters.frequency, parameters.psLevel, parameters.spontaneousRate, updateSimulationState]);


  const handleToggleAnesthesia = useCallback(() => {
    if (operatingMode === 'anesthesia') {
      if (!isAnesthesiaActive && !isVentilationActive && isMechanicalVentilation) {
        alert(t.startGasAnesthesiaVentilationInactiveError);
        return;
      }
      setIsAnesthesiaActive(prevIsActive => {
        const newActiveState = !prevIsActive;
        if (newActiveState) {
          logSessionEvent('record_log_anesthesia_started');
          if (!anesthesiaStartTime) setAnesthesiaStartTime(Date.now());
        } else {
          logSessionEvent('record_log_anesthesia_stopped');
        }
        return newActiveState;
      });
    }
  }, [operatingMode, isVentilationActive, anesthesiaStartTime, t, isMechanicalVentilation, logSessionEvent]);

  const handleRefillSelectedAgents = useCallback(() => {
    if (operatingMode === 'anesthesia') {
      if (isAnesthesiaActive) {
        setAnesthesiaOffRequiredModalOpen(true);
        return;
      }
      const agentsThatNeedRefill = selectedAnestheticGases.filter(gas => (agentLevels[gas] ?? 0) < 99.9);
      if (agentsThatNeedRefill.length > 0) {
        logSessionEvent('record_log_agent_refilled', { agents: agentsThatNeedRefill.join(', ') });
        setInitialAgentLevelsForAnimation(prev => ({ ...prev, ...agentLevels }));
        setIsRefillingAgents(agentsThatNeedRefill);
        setRefillStartTime(Date.now());
      }
    }
  }, [operatingMode, isAnesthesiaActive, selectedAnestheticGases, agentLevels, logSessionEvent]);

  const handleReplaceSodaLime = useCallback(() => {
    if (operatingMode === 'anesthesia') {
      if (isAnesthesiaActive) {
        setAnesthesiaOffRequiredModalOpen(true);
        return;
      }
      if (Number(parameters.sodaLimeRemainingPercent) > 0.1) {
        logSessionEvent('record_log_sodalime_replaced');
        setInitialSodaLimeLevelForAnimation(Number(parameters.sodaLimeRemainingPercent));
        setIsReplacingSodaLime(true);
        setRefillStartTime(Date.now());
      }
    }
  }, [operatingMode, isAnesthesiaActive, parameters.sodaLimeRemainingPercent, logSessionEvent]);

  useEffect(() => {
    let animationFrameId: number;

    if (refillStartTime) {
      const animateRefillOrReplacement = () => {
        const elapsedTime = Date.now() - refillStartTime;
        const progress = Math.min(1, elapsedTime / 10000);

        let agentsDone = false;
        let sodaLimeDone = false;

        if (isRefillingAgents.length > 0 && initialAgentLevelsForAnimation) {
          const newLevels = { ...agentLevels };
          let allAgentsAtTarget = true;
          isRefillingAgents.forEach(gas => {
            const initialLevel = initialAgentLevelsForAnimation[gas] ?? 0;
            const targetLevel = 100;
            const currentAnimatedLevel = initialLevel + (targetLevel - initialLevel) * progress;
            newLevels[gas] = parseFloat(currentAnimatedLevel.toFixed(2));
            if (newLevels[gas] < targetLevel - 0.01) allAgentsAtTarget = false;
          });
          setAgentLevels(newLevels);
          if (progress >= 1 || allAgentsAtTarget) agentsDone = true;
        } else {
          agentsDone = true;
        }

        if (isReplacingSodaLime && initialSodaLimeLevelForAnimation !== null) {
          const initialConsumption = initialSodaLimeLevelForAnimation;
          const targetConsumption = 0;
          const currentAnimatedConsumption = initialConsumption + (targetConsumption - initialConsumption) * progress;
          const newConsumption = parseFloat(Math.max(0, currentAnimatedConsumption).toFixed(2));
          setParameters(prev => ({ ...prev, sodaLimeRemainingPercent: newConsumption }));
          if (progress >= 1 || newConsumption <= targetConsumption + 0.01) sodaLimeDone = true;
        } else {
          sodaLimeDone = true;
        }

        if ((agentsDone && sodaLimeDone) || progress >= 1) {
          if (isRefillingAgents.length > 0) {
            const finalAgentLevels = { ...agentLevels };
            isRefillingAgents.forEach(gas => { finalAgentLevels[gas] = 100; });
            setAgentLevels(finalAgentLevels);
          }
          if (isReplacingSodaLime) {
            setParameters(prev => ({ ...prev, sodaLimeRemainingPercent: 0 }));
          }

          setIsRefillingAgents([]);
          setIsReplacingSodaLime(false);
          setRefillStartTime(null);
          setInitialAgentLevelsForAnimation(null);
          setInitialSodaLimeLevelForAnimation(null);
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
        } else {
          animationFrameId = requestAnimationFrame(animateRefillOrReplacement);
        }
      };
      animationFrameId = requestAnimationFrame(animateRefillOrReplacement);
    }
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [refillStartTime, isRefillingAgents, isReplacingSodaLime, agentLevels, initialAgentLevelsForAnimation, initialSodaLimeLevelForAnimation, parameters.sodaLimeRemainingPercent]);


  const handleSelectAnestheticGas = useCallback((gas: AnestheticGasType) => {
    if (operatingMode === 'anesthesia' && !isAnesthesiaActive) {
      setSelectedAnestheticGases(prevSelected => {
        const isAlreadySelected = prevSelected.includes(gas);
        if (isAlreadySelected) {
          logSessionEvent('record_log_gas_deselected', AnestheticGasType[gas]);
          return prevSelected.filter(g => g !== gas);
        } else {
          if (prevSelected.length < 2) {
            logSessionEvent('record_log_gas_selected', AnestheticGasType[gas]);
            return [...prevSelected, gas];
          }
          return prevSelected;
        }
      });
    }
  }, [operatingMode, isAnesthesiaActive, logSessionEvent]);

  const handleToggleModeSelector = useCallback(() => setIsModeSelectorOpen(prev => !prev), []);

  const handleSelectVentilationMode = useCallback((mode: VentilationMode) => {
    setCurrentMode(mode);
    logSessionEvent('record_log_vent_mode_changed', VentilationMode[mode]);
    setIsModeSelectorOpen(false);
    setIsModeChanging(true);
    setActiveManeuver(null);
    setManeuverResultsPackage(null);
    setParameters(prev => {
        const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(
            mode,
            prev.frequency,
            prev.psLevel,
            simulatorSettings.patientProfile.spontaneousRate
        );
        let newParams = {...prev, measuredFrequency, spontaneousRate};
        if (mode === VentilationMode.VC) {
            newParams.pressureTarget = INITIAL_PARAMETERS.pressureTarget;
        } else if (mode === VentilationMode.PC) {
            newParams.volume = INITIAL_PARAMETERS.volume;
        }
        // Run a simulation step immediately to update monitored values like Ppeak
        return updateSimulationState(newParams, mode);
    });

    setTimeout(() => setIsModeChanging(false), 500);
  }, [logSessionEvent, simulatorSettings.patientProfile.spontaneousRate, updateSimulationState]);

  const handleOpenParameterModal = useCallback((paramKey: ParameterKey, label: string, currentValue: string | number, unit: string) => {
    setModalState({ isOpen: true, paramKey, paramLabel: label, currentValue: String(currentValue), unit });
  }, []);

  const handleCloseParameterModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false, paramKey: null }));
  }, []);

  const handleConfirmParameterChange = useCallback((newValue: string) => {
    if (modalState.paramKey) {
      const paramDef = PARAMETER_DEFINITIONS[modalState.paramKey];
      let finalValue: string | number = newValue;
      const paramKey = modalState.paramKey;

      const unitLabel = paramDef.unitKey && t[paramDef.unitKey] ? t[paramDef.unitKey] : '';
      const labelText = paramDef.labelKey && t[paramDef.labelKey] ? t[paramDef.labelKey] : '';
      const ratioLabelText = t.param_ratio_label || 'I:E Ratio';

      if (unitLabel !== t.unit_none && labelText !== ratioLabelText) {
        const parsedNum = parseFloat(newValue);
        if (!isNaN(parsedNum)) {
            let clampedNum = parsedNum;
            // Min/Max clamping logic will be handled inside ParameterModal for dynamic HF values
            if (operatingMode === 'icu' && icuSubMode === 'high-flow' && paramKey === 'fgf') {
                 const currentInterface = parameters.highFlowInterfaceType;
                 const minFGF = currentInterface === 'adult' ? HIGH_FLOW_ADULT_FGF_MIN : HIGH_FLOW_PEDIATRIC_FGF_MIN;
                 const maxFGF = currentInterface === 'adult' ? HIGH_FLOW_ADULT_FGF_MAX : HIGH_FLOW_PEDIATRIC_FGF_MAX_CONSTANT; 
                 clampedNum = Math.max(minFGF, Math.min(maxFGF, clampedNum));
            } else if (operatingMode === 'icu' && icuSubMode === 'high-flow' && paramKey === 'temperature') {
                 const currentInterface = parameters.highFlowInterfaceType;
                 const maxTemp = currentInterface === 'junior' ? HIGH_FLOW_TEMP_MAX_JUNIOR : HIGH_FLOW_TEMP_MAX_ADULT; 
                 clampedNum = Math.max(HIGH_FLOW_TEMP_MIN, Math.min(maxTemp, clampedNum)); 
            } else {
                if (paramDef.min !== undefined) clampedNum = Math.max(paramDef.min, clampedNum);
                if (paramDef.max !== undefined) clampedNum = Math.min(paramDef.max, clampedNum);
            }


            if (paramDef.step && paramDef.step % 1 === 0) {
                 finalValue = Math.round(clampedNum / paramDef.step) * paramDef.step;
            } else if (paramDef.step) {
                 const precision = -Math.floor(Math.log10(paramDef.step));
                 finalValue = parseFloat(clampedNum.toFixed(precision));
            } else { // No step, could be dynamic step for FGF
                 finalValue = clampedNum;
            }

            // Ensure specific values for HF temperature
            if (operatingMode === 'icu' && icuSubMode === 'high-flow' && paramKey === 'temperature') {
                const allowedTemps = parameters.highFlowInterfaceType === 'junior' ? [31,34] : [31,34,37];
                const closestTemp = allowedTemps.reduce((prev, curr) => (Math.abs(curr - Number(finalValue)) < Math.abs(prev - Number(finalValue)) ? curr : prev));
                finalValue = closestTemp;
            }


        } else {
            finalValue = paramDef.min !== undefined ? paramDef.min : 0;
        }
      } else {
         finalValue = newValue;
      }

      logSessionEvent('record_log_parameter_changed', { param: paramKey, value: finalValue });

      if (operatingMode === 'icu' && icuSubMode === 'high-flow' && paramKey === 'temperature') {
        hfTempRampRef.current = null;
      }

      setParameters(prev => {
        let newParams = { ...prev, [paramKey!]: finalValue };
        // If frequency is changed, we must update the measured frequency for the simulation.
        if (paramKey === 'frequency') {
            const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(
                currentMode,
                Number(finalValue),
                newParams.psLevel,
                simulatorSettings.patientProfile.spontaneousRate
            );
            newParams.measuredFrequency = measuredFrequency;
            newParams.spontaneousRate = spontaneousRate;
        }
        return updateSimulationState(newParams);
      });

      if (paramKey === 'humidifierTemperature') {
        const newTemp = Number(finalValue);
        setHumidifierSettings(prev => ({ ...prev, temperature: newTemp }));
      }
    }
    handleCloseParameterModal();
  }, [modalState, handleCloseParameterModal, t, logSessionEvent, operatingMode, icuSubMode, parameters.highFlowInterfaceType, updateSimulationState, currentMode, simulatorSettings.patientProfile.spontaneousRate]);

  const handleToggleRegularPatientSettingsModal = useCallback(() =>
    setPatientDataModalInfo(prev => ({
        ...prev,
        isOpen: !prev.isOpen,
        pendingOperatingMode: prev.pendingOperatingMode || operatingMode,
        pendingIcuSubModeForSetup: prev.pendingIcuSubModeForSetup || (operatingMode === 'icu' ? icuSubMode : null),
        pendingHighFlowInterfaceForSetup: prev.pendingHighFlowInterfaceForSetup || (operatingMode === 'icu' && icuSubMode === 'high-flow' ? parameters.highFlowInterfaceType : null),
        overrideTitle: 'patientSettingsTitle'
    })),
  [operatingMode, icuSubMode, parameters.highFlowInterfaceType]);


  const handleToggleAlarmSettingsModal = useCallback(() => setIsAlarmSettingsModalOpen(prev => !prev), []);
  const handleConfirmAlarmSettings = useCallback((settings: AlarmSettings) => {
    setAlarmSettings(settings);
    logSessionEvent('record_log_alarm_settings_changed', settings);
    handleToggleAlarmSettingsModal();
  }, [handleToggleAlarmSettingsModal, logSessionEvent]);


  const handleToggleHumidifierPower = useCallback(() => {
    setHumidifierSettings(prev => {
        const newIsOn = !prev.isOn;
        logSessionEvent(newIsOn ? 'record_log_humidifier_on' : 'record_log_humidifier_off');
        return { ...prev, isOn: newIsOn };
    });
  }, [logSessionEvent]);


  const toggleFreezeWaveforms = useCallback(() => {
    setAreWaveformsFrozen(prev => {
      const newState = !prev;
      logSessionEvent(newState ? 'record_log_waveforms_frozen' : 'record_log_waveforms_unfrozen');
      return newState;
    });
  }, [logSessionEvent]);

  const startInspiratoryHold = useCallback(() => {
    if (isVentilationActive && !activeManeuver) {
      logSessionEvent('record_log_insp_hold_started');
      setHeldVolumeInspired(Number(parameters.volumeInspired));
      const currentPpeak = Number(parameters.pPeak);
      const currentFreq = Number(parameters.frequency);
      const currentTiTtot = Number(parameters.tiTtot);
      let avgInspFlow = null;
      if (currentFreq > 0 && currentTiTtot > 0 && Number(parameters.volumeInspired) > 0) {
        const inspiratoryTimeSeconds = (60 / currentFreq) * currentTiTtot;
        if (inspiratoryTimeSeconds > 0) avgInspFlow = (Number(parameters.volumeInspired) / 1000) / inspiratoryTimeSeconds;
      }
      setCapturedPpeakForResistance(currentPpeak);
      setCapturedAvgInspFlowLPS(avgInspFlow);
      setActiveManeuver('insp_hold');
      setManeuverStartTime(Date.now());
      setAreWaveformsFrozen(false);
      setManeuverResultsPackage(null);
    }
  }, [isVentilationActive, activeManeuver, parameters, logSessionEvent]);

  const startExpiratoryHold = useCallback(() => {
    if (isVentilationActive && !activeManeuver) {
      logSessionEvent('record_log_exp_hold_started');
      setActiveManeuver('exp_hold');
      setManeuverStartTime(Date.now());
      setAreWaveformsFrozen(false);
      setManeuverResultsPackage(null);
      setCapturedPpeakForResistance(null);
      setCapturedAvgInspFlowLPS(null);
    }
  }, [isVentilationActive, activeManeuver, logSessionEvent]);

  const handleO2Flush = useCallback(() => {
    if (operatingMode === 'anesthesia' && isVentilationActive && !isO2FlushActive) {
        logSessionEvent('record_log_o2_flush_activated');
        setPreFlushFio2(Number(parameters.fio2));
        setIsO2FlushActive(true);
        setO2FlushTimerEnd(Date.now() + O2_FLUSH_DURATION_MS);
        setParameters(prev => ({...prev, fio2: 100}));
    }
  }, [operatingMode, isVentilationActive, isO2FlushActive, parameters.fio2, logSessionEvent]);

  const handleSetMechanicalVentilationMode = useCallback((newMechVentState: boolean) => {
    if (operatingMode === 'anesthesia') {
        if (newMechVentState === isMechanicalVentilation) return; 

        setIsMechanicalVentilation(newMechVentState);
        logSessionEvent(newMechVentState ? 'record_log_mech_vent_on' : 'record_log_mech_vent_off', newMechVentState ? "Mechanical" : "Bag-Mask");
        
        let newMode = currentMode;
        if (newMechVentState) { // Switching TO Mechanical
            newMode = simulatorSettings.ventilationDefaults.defaultModeAnesthesiaMechanical;
            setCurrentMode(newMode);
        }
        
        setParameters(p => {
            let newParams = {...p, isMechanicalVentilation: newMechVentState ? 1 : 0};
            if (newMechVentState) {
                newParams = {
                    ...newParams,
                    peep: simulatorSettings.ventilationDefaults.defaultInitialPeep,
                    volume: INITIAL_PARAMETERS.volume,
                    frequency: INITIAL_PARAMETERS.frequency,
                    ratio: INITIAL_PARAMETERS.ratio,
                    pressureTarget: INITIAL_PARAMETERS.pressureTarget,
                    psLevel: INITIAL_PARAMETERS.psLevel,
                    triggerFlow: INITIAL_PARAMETERS.triggerFlow,
                };
            } else { // Switching TO Bag-Mask (Manual)
                newParams = {
                    ...newParams,
                    peep: simulatorSettings.anesthesia.defaultAPL, // APL Valve
                    volume: INITIAL_PARAMETERS.volume,
                    frequency: INITIAL_PARAMETERS.frequency,
                    ratio: INITIAL_PARAMETERS.ratio,
                    pressureTarget: INITIAL_PARAMETERS.pressureTarget,
                    psLevel: INITIAL_PARAMETERS.psLevel,
                };
            }
            return updateSimulationState(newParams, newMode);
        });
    }
  }, [operatingMode, simulatorSettings, logSessionEvent, isMechanicalVentilation, updateSimulationState, currentMode]);

  const handleOpenSimulatorSettingsModal = useCallback(() => {
    setIsSimulatorSettingsModalOpen(true);
  }, []);

  const handleCloseSimulatorSettingsModal = useCallback(() => {
    setIsSimulatorSettingsModalOpen(false);
  }, []);

  const handleConfirmSimulatorSettings = useCallback((newSettings: SimulatorSettings) => {
    setSimulatorSettings(newSettings);
    if (!isSimulatorOn) {
        setPatientSettings({
            age: newSettings.patientProfile.age,
            gender: newSettings.patientProfile.gender,
            weight: newSettings.patientProfile.weight,
        });
        setHumidifierSettings({
            isOn: newSettings.general.humidifierDefaultOn,
            temperature: newSettings.general.humidifierDefaultTemp,
        });

        const initialAgentLvls: AgentLevels = {} as AgentLevels;
        ANESTHETIC_GAS_ORDER.forEach(gas => initialAgentLvls[gas] = 100);
        newSettings.anesthesia.vaporizers.forEach(vap => {
             if (initialAgentLvls.hasOwnProperty(vap.gas)) {
                initialAgentLvls[vap.gas] = vap.level;
            }
        });
        setAgentLevels(initialAgentLvls);
        setSelectedAnestheticGases(
            newSettings.anesthesia.vaporizers.length > 0
            ? [newSettings.anesthesia.vaporizers[0].gas]
            : (ANESTHETIC_GAS_ORDER[0] ? [ANESTHETIC_GAS_ORDER[0]] : [])
        );
        hfTempRampRef.current = null;

        setParameters(prev => ({
            ...INITIAL_PARAMETERS,
            ...newSettings.patientProfile,
            sodaLimeRemainingPercent: newSettings.anesthesia.sodaLimeRemainingPercent,
            fgf: newSettings.anesthesia.defaultFGF, // Will be overridden for HF on interface selection
            peep: newSettings.anesthesia.defaultAPL, // Will be overridden for ICU/HF
            fio2: newSettings.ventilationDefaults.defaultInitialFio2,
            targetMac: newSettings.anesthesia.defaultTargetMAC,
            temperature: newSettings.highFlow.defaultTempAdult, // Default to adult, will be overridden
            deliveredTemperature: AMBIENT_TEMPERATURE,
            humidifierTemperature: newSettings.general.humidifierDefaultTemp,
            waterLevelPercent: newSettings.highFlow.initialWaterLevelPercent,
            lastDisinfectionStatus: newSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean',
            highFlowInterfaceType: newSettings.highFlow.interfaceType || 'adult',
            isMechanicalVentilation: 0,
        }));

        const updatedLastSelfTestResults: LastSelfTestResults = {};
        for (const key in newSettings.general) {
           if (Object.prototype.hasOwnProperty.call(newSettings.general, key) && POST_SCREEN_CONFIG[key as PostScreenKey]) {
                const setting = newSettings.general[key as PostScreenKey];
                if (setting.performed && setting.dateTime) {
                    updatedLastSelfTestResults[key as PostScreenKey] = setting.dateTime;
                } else {
                    updatedLastSelfTestResults[key as PostScreenKey] = null;
                }
            }
        }
        setLastSelfTestResults(updatedLastSelfTestResults);
        resetSnoozeState();
        if (newSettings.general.resetAlarmsOnNewPatient) {
            setAlarmSettings(JSON.parse(JSON.stringify(INITIAL_ALARM_SETTINGS)));
        }
    }
    setIsSimulatorSettingsModalOpen(false);
  }, [isSimulatorOn, resetSnoozeState]);

  const handleOpenManualModal = useCallback(() => {
    logSessionEvent('manualButtonTooltip');
    setManualModalState({ isOpen: true });
  }, [logSessionEvent]);

  const handleCloseManualModal = useCallback(() => {
    setManualModalState({ isOpen: false });
  }, []);

  const handleToggleRecording = useCallback(() => {
    const newRecordingState = !isRecordingEnabledForNextSession;
    setIsRecordingEnabledForNextSession(newRecordingState);
    if (newRecordingState) {
        alert(t.record_log_download_prompt);
    }
  }, [isRecordingEnabledForNextSession, t]);

  const handleOpenLivePatientSettingsModal = useCallback(() => setIsLivePatientSettingsModalOpen(true), []);
  const handleCloseLivePatientSettingsModal = useCallback(() => setIsLivePatientSettingsModalOpen(false), []);
  
  const handleConfirmLivePatientSettings = useCallback((newPhysiology: PatientPhysiologySettings) => {
      logSessionEvent('record_log_live_patient_settings_changed', {
          compliance: newPhysiology.compliance,
          resistance: newPhysiology.resistance,
          spontaneousRate: newPhysiology.spontaneousRate,
          preset: newPhysiology.selectedPreset
      });
  
      setSimulatorSettings(prev => ({
          ...prev,
          patientProfile: {
              ...prev.patientProfile,
              ...newPhysiology,
          }
      }));
  
      setParameters(prev => {
          const newLiveParams = {
              ...prev,
              compliance: newPhysiology.compliance,
              resistance: newPhysiology.resistance,
              expiratoryEffortFactor: newPhysiology.expiratoryEffortFactor ?? 0,
              inspiratoryEffortStrength: newPhysiology.inspiratoryEffortStrength ?? 0,
              expiratoryFlowLimitationFactor: newPhysiology.expiratoryFlowLimitationFactor ?? 0,
              secretionsFactor: newPhysiology.secretionsFactor ?? 0,
          };
          const { measuredFrequency, spontaneousRate } = getUpdatedRatesForMode(
              currentMode,
              prev.frequency,
              prev.psLevel,
              newPhysiology.spontaneousRate
          );
          newLiveParams.measuredFrequency = measuredFrequency;
          newLiveParams.spontaneousRate = spontaneousRate;
  
          return updateSimulationState(newLiveParams);
      });
  
      setIsLivePatientSettingsModalOpen(false);
  }, [logSessionEvent, currentMode, updateSimulationState]);


  if ((isSelfTestRunning && currentPostScreenKey) || (isDisinfecting && currentPostScreenKey === 'high_flow_post')) {
    const items = isDisinfecting && disinfectionProgressItem ? [disinfectionProgressItem] : selfTestProgressItems;
    const titleKey = isDisinfecting ? 'disinfectionCycleInProgressTitle' : 'selfTestInProgressTitle';
    return (
      <SelfTestPopup
        isOpen={isSelfTestRunning || isDisinfecting}
        progressItems={items}
        currentTheme={effectiveTheme}
        overrideTitleKey={isDisinfecting ? titleKey : undefined}
      />
    );
  }

  if (currentPostScreenKey) {
    const postConfig = POST_SCREEN_CONFIG[currentPostScreenKey];
    const disinfectionStatusForPost = currentPostScreenKey === 'high_flow_post' ? (simulatorSettings.general.high_flow_post?.lastDisinfectionStatus || 'clean') : null;
    return (
      <PostScreen
        deviceTitleKey={postConfig.deviceTitleKey}
        lastTestTime={lastSelfTestResults[currentPostScreenKey] || null}
        lastDisinfectionStatus={disinfectionStatusForPost}
        onPerformSelfTest={() => handlePerformSelfTest(currentPostScreenKey)}
        onStartup={(selectedInterface?: HighFlowInterfaceType) => handleProceedFromPostScreen(currentPostScreenKey, selectedInterface)}
        currentTheme={effectiveTheme}
        onExitPostScreen={handleBackFromPostScreen}
        currentPostScreenKey={currentPostScreenKey}
        selectedIcuSubModeOnPostScreen={selectedIcuSubModeOnPostScreen} // For ICU General POST
        onSelectIcuSubModeOnPostScreen={handleSelectIcuSubModeOnPostScreen} // For ICU General POST
        initialHighFlowInterfaceType={postConfig.initialHighFlowInterfaceType} // For High Flow POST
        onStartDisinfectionCycle={handleStartDisinfectionCycle}
      />
    );
  }

  if (patientDataModalInfo.isOpen) {
     let modalTheme: ThemeName = effectiveTheme;
     const pendingOp = patientDataModalInfo.pendingOperatingMode;
     const pendingSubSetup = patientDataModalInfo.pendingIcuSubModeForSetup;
    //  const pendingHfInterface = patientDataModalInfo.pendingHighFlowInterfaceForSetup; // Not used for theme override logic here

     if (patientDataModalInfo.overrideTitle === 'patientSettingsTitle') {
         modalTheme = effectiveTheme;
     } else {
         if (pendingOp === 'anesthesia') {
             modalTheme = 'anesthesia';
         } else if (pendingOp === 'icu') {
             if (pendingSubSetup === 'high-flow') {
                 modalTheme = 'highFlow';
             } else if (pendingSubSetup === 'non-invasive') {
                 modalTheme = 'nonInvasive';
             } else {
                 modalTheme = pendingSubSetup === 'invasive' ? 'icu' : 'nonInvasive'; // Default to nonInvasive or icu if not specifically set
             }
         }
     }
      return (
           <PatientSettingsModal
              isOpen={patientDataModalInfo.isOpen}
              currentSettings={patientSettings}
              currentTheme={modalTheme}
              onConfirm={handleConfirmPatientDataAndProceed}
              onClose={handleClosePatientDataModal}
              overrideTitle={patientDataModalInfo.overrideTitle}
          />
      );
  }

  if (isSimulatorSettingsModalOpen) {
    return (
        <SimulatorSettingsModal
            isOpen={isSimulatorSettingsModalOpen}
            currentSettings={simulatorSettings}
            onConfirm={handleConfirmSimulatorSettings}
            onClose={handleCloseSimulatorSettingsModal}
        />
    );
  }

  if (manualModalState.isOpen) {
    return (
        <ManualModal
            isOpen={manualModalState.isOpen}
            onClose={handleCloseManualModal}
            currentTheme={effectiveTheme}
        />
    );
  }


  if (!isSimulatorOn || !operatingMode) {
    return <StartupScreen
                onSelectMode={handleModeSelectionFromStartup}
                onOpenSimulatorSettings={handleOpenSimulatorSettingsModal}
                onOpenManualModal={handleOpenManualModal}
                onToggleRecording={handleToggleRecording}
                isRecordingEnabled={isRecordingEnabledForNextSession}
            />;
  }


  if (operatingMode === 'icu' && !icuSubMode) {
    return <ICUModeSelectionScreen onSelect={handleSelectICUSubMode} onBack={handlePowerOff} currentTheme={effectiveTheme} />;
  }

  const isHighFlowMode = operatingMode === 'icu' && icuSubMode === 'high-flow';

  return (
    <>
      <VentilatorInterface
        currentTime={currentTime}
        currentMode={currentMode}
        operatingMode={operatingMode}
        icuSubMode={icuSubMode}
        currentTheme={effectiveTheme}
        isSimulatorOn={isSimulatorOn}
        isVentilationActive={isVentilationActive}
        isWarmingUpHF={isWarmingUpHF}
        isRecordingActive={isSessionActiveRecording}
        isModeSelectorOpen={isModeSelectorOpen}
        isAnesthesiaActive={isAnesthesiaActive}
        selectedAnestheticGases={selectedAnestheticGases}
        agentLevels={agentLevels}
        parameters={parameters}
        ventilatorData={ventilatorData}
        patientSettings={patientSettings}
        alarmSettings={alarmSettings}
        activeAlarms={activeAlarms}
        hasActiveAlarms={hasActiveAlarmsState}
        isAlarmSnoozed={isAlarmSnoozed}
        snoozeCountdownDisplay={snoozeCountdownDisplay}
        onToggleAlarmSnooze={handleToggleAlarmSnooze}
        humidifierSettings={humidifierSettings}
        isModeChanging={isModeChanging}
        areWaveformsFrozen={areWaveformsFrozen}
        activeManeuver={activeManeuver}
        maneuverResultsPackage={maneuverResultsPackage}
        onClearManeuverResults={handleClearManeuverResults} // New prop
        isO2FlushActive={isO2FlushActive}
        o2FlushTimerEnd={o2FlushTimerEnd} 
        isMechanicalVentilation={isMechanicalVentilation}
        currentSweepSpeedValue={currentSweepSpeedValue}
        scanlinePixelRate={effectiveScanlinePixelRate}
        onChangeSweepSpeed={handleChangeSweepSpeed}
        onPowerOff={handlePowerOff}
        onToggleVentilation={handleToggleVentilation}
        onToggleAnesthesia={handleToggleAnesthesia}
        onSelectAnestheticGas={handleSelectAnestheticGas}
        onRefillSelectedAgents={handleRefillSelectedAgents} 
        onReplaceSodaLime={handleReplaceSodaLime}    
        isRefillingAgents={isRefillingAgents}         
        isReplacingSodaLime={isReplacingSodaLime}     
        onToggleModeSelector={handleToggleModeSelector}
        onSelectVentilationMode={handleSelectVentilationMode}
        onOpenParameterModal={handleOpenParameterModal}
        onTogglePatientSettingsModal={handleToggleRegularPatientSettingsModal}
        onToggleAlarmSettingsModal={handleToggleAlarmSettingsModal}
        onToggleHumidifierPower={handleToggleHumidifierPower} 
        onToggleFreezeWaveforms={toggleFreezeWaveforms}
        onStartInspiratoryHold={startInspiratoryHold}
        onStartExpiratoryHold={startExpiratoryHold}
        onO2Flush={handleO2Flush}
        onSetMechanicalVentilationMode={handleSetMechanicalVentilationMode} // Pass updated prop
        onBackToICUSubModeSelection={handleBackToICUSubModeSelection}
        onOpenManualModal={handleOpenManualModal}
        onOpenLivePatientSettingsModal={handleOpenLivePatientSettingsModal}
      />
      {modalState.isOpen && modalState.paramKey && (
         <ParameterModal
            isOpen={modalState.isOpen}
            title={t[PARAMETER_DEFINITIONS[modalState.paramKey].labelKey]}
            initialValue={modalState.currentValue}
            unit={t[PARAMETER_DEFINITIONS[modalState.paramKey].unitKey]}
            paramKey={modalState.paramKey}
            currentTheme={effectiveTheme}
            operatingMode={operatingMode} 
            icuSubMode={icuSubMode}         
            highFlowInterfaceType={parameters.highFlowInterfaceType} 
            onConfirm={handleConfirmParameterChange}
            onClose={handleCloseParameterModal}
        />
      )}
      <AlarmSettingsModal
        isOpen={isAlarmSettingsModalOpen}
        currentSettings={alarmSettings}
        operatingMode={operatingMode}
        icuSubMode={icuSubMode}
        highFlowInterfaceType={parameters.highFlowInterfaceType} 
        currentTheme={effectiveTheme}
        onConfirm={handleConfirmAlarmSettings}
        onClose={handleToggleAlarmSettingsModal}
      />
      <AnesthesiaOffRequiredModal
        isOpen={anesthesiaOffRequiredModalOpen}
        onClose={() => setAnesthesiaOffRequiredModalOpen(false)}
        currentTheme={effectiveTheme}
      />
      {isLivePatientSettingsModalOpen && (
        <LivePatientSettingsModal
            isOpen={isLivePatientSettingsModalOpen}
            currentPhysiology={simulatorSettings.patientProfile}
            currentTheme={effectiveTheme}
            onConfirm={handleConfirmLivePatientSettings}
            onClose={handleCloseLivePatientSettingsModal}
        />
      )}
    </>
  );
};

export default App;