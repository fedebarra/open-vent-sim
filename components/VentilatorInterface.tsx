import React from 'react';
import { Header } from './Header';
import { LeftPanel } from './LeftPanel';
import { GraphsPanel } from './GraphsPanel';
import { RightPanel } from './RightPanel';
import { Footer } from './Footer';
import { VentilationMode, AnestheticGasType, ParameterKey, AllParameters, OperatingMode, ICUSubMode, PatientSettings, AlarmSettings, HumidifierSettings, AlarmParameterKey, ActiveManeuver, ManeuverResultsPackage, AgentLevels, ThemeName, HighFlowInterfaceType, SweepSpeedValue, VentilatorData } from '../types';
import { THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';

interface VentilatorInterfaceProps {
  currentTime: Date;
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  isSimulatorOn: boolean;
  isVentilationActive: boolean;
  isWarmingUpHF: boolean; // New prop
  isRecordingActive?: boolean; 
  isModeSelectorOpen: boolean;
  isAnesthesiaActive: boolean;
  selectedAnestheticGases: AnestheticGasType[];
  agentLevels: AgentLevels;
  parameters: AllParameters;
  ventilatorData: VentilatorData | null;
  patientSettings: PatientSettings;
  alarmSettings: AlarmSettings;
  activeAlarms: Partial<Record<AlarmParameterKey, boolean>>;
  hasActiveAlarms: boolean; 
  isAlarmSnoozed: boolean; 
  snoozeCountdownDisplay: number | null; // New prop for countdown display
  onToggleAlarmSnooze: () => void; 
  humidifierSettings: HumidifierSettings;
  isModeChanging: boolean;
  areWaveformsFrozen: boolean;
  activeManeuver: ActiveManeuver | null;
  maneuverResultsPackage: ManeuverResultsPackage | null;
  onClearManeuverResults: () => void; // New
  isO2FlushActive: boolean;
  o2FlushTimerEnd: number | null; 
  isMechanicalVentilation: boolean;
  currentSweepSpeedValue: SweepSpeedValue; // New
  scanlinePixelRate: number; // New
  onChangeSweepSpeed: () => void; // New
  onPowerOff: () => void;
  onToggleVentilation: () => void;
  onToggleAnesthesia: () => void;
  onSelectAnestheticGas: (gas: AnestheticGasType) => void;
  onRefillSelectedAgents: () => void; 
  onReplaceSodaLime: () => void;    
  isRefillingAgents: AnestheticGasType[]; 
  isReplacingSodaLime: boolean;       
  onToggleModeSelector: () => void;
  onSelectVentilationMode: (mode: VentilationMode) => void;
  onOpenParameterModal: (paramKey: ParameterKey, label: string, currentValue: string | number, unit: string) => void;
  onTogglePatientSettingsModal: () => void;
  onToggleAlarmSettingsModal: () => void;
  onToggleHumidifierPower: () => void; 
  onToggleFreezeWaveforms: () => void;
  onStartInspiratoryHold: () => void;
  onStartExpiratoryHold: () => void;
  onO2Flush: () => void;
  onSetMechanicalVentilationMode: (isMechanical: boolean) => void; // Updated prop
  onBackToICUSubModeSelection: () => void;
  onOpenManualModal: () => void; 
  onOpenLivePatientSettingsModal: () => void;
}

export const VentilatorInterface: React.FC<VentilatorInterfaceProps> = (props) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[props.currentTheme];
  const showAnesthesiaFeatures = props.operatingMode === 'anesthesia';
  const isIcuMode = props.operatingMode === 'icu';

  return (
    <div className={`w-screen h-screen bg-gradient-to-br from-gray-700 to-gray-800 border-3 ${themeColors.border} rounded-lg shadow-2xl shadow-black/50 relative overflow-hidden flex flex-col transition-opacity duration-500 ease-in-out opacity-100`}>
      <Header
        currentTime={props.currentTime}
        isAnesthesiaActive={props.isAnesthesiaActive && showAnesthesiaFeatures}
        isVentilationActive={props.isVentilationActive}
        isWarmingUpHF={props.isWarmingUpHF} 
        isO2FlushActive={props.isO2FlushActive}
        o2FlushTimerEnd={props.o2FlushTimerEnd} 
        isRecordingActive={props.isRecordingActive}
        hasActiveAlarms={props.hasActiveAlarms}
        isAlarmSnoozed={props.isAlarmSnoozed}
        snoozeCountdownDisplay={props.snoozeCountdownDisplay}
        onToggleAlarmSnooze={props.onToggleAlarmSnooze}
        onOpenManualModal={props.onOpenManualModal} 
        onOpenLivePatientSettingsModal={props.onOpenLivePatientSettingsModal}
        onPowerOff={props.onPowerOff}
        operatingMode={props.operatingMode}
        icuSubMode={props.icuSubMode}
        currentTheme={props.currentTheme}
        highFlowInterfaceType={props.parameters.highFlowInterfaceType} 
        humidifierSettings={props.humidifierSettings}
        onTogglePatientSettingsModal={props.onTogglePatientSettingsModal}
        onToggleAlarmSettingsModal={props.onToggleAlarmSettingsModal}
        onBackToICUSubModeSelection={props.onBackToICUSubModeSelection}
      />

      <main className={`grid grid-cols-[300px_1fr_320px] xl:grid-cols-[280px_1fr_300px] grid-rows-1 h-[calc(100vh-60px-40px)] gap-px flex-1 relative bg-gray-700`}>
        <LeftPanel
          parameters={props.parameters}
          currentMode={props.currentMode}
          operatingMode={props.operatingMode}
          icuSubMode={props.icuSubMode}
          currentTheme={props.currentTheme}
          selectedAnestheticGases={props.selectedAnestheticGases}
          agentLevels={props.agentLevels}
          isAnesthesiaActive={props.isAnesthesiaActive && showAnesthesiaFeatures}
          isVentilationActive={props.isVentilationActive}
          isMechanicalVentilation={props.isMechanicalVentilation}
          alarmSettings={props.alarmSettings}
          activeAlarms={props.activeAlarms}
          activeManeuver={props.activeManeuver}
          humidifierSettings={props.humidifierSettings}
          onOpenParameterModal={props.onOpenParameterModal}
          onSelectGas={props.onSelectAnestheticGas}
          onToggleAnesthesia={props.onToggleAnesthesia}
          onRefillSelectedAgents={props.onRefillSelectedAgents} 
          onReplaceSodaLime={props.onReplaceSodaLime}       
          isRefillingAgents={props.isRefillingAgents}         
          isReplacingSodaLime={props.isReplacingSodaLime}     
          onSelectVentilationMode={props.onSelectVentilationMode}
          onStartInspiratoryHold={props.onStartInspiratoryHold}
          onStartExpiratoryHold={props.onStartExpiratoryHold}
          onToggleHumidifierPower={props.onToggleHumidifierPower} 
        />
        <GraphsPanel
            isSimulatorOn={props.isSimulatorOn}
            isVentilationActive={props.isVentilationActive}
            isWarmingUpHF={props.isWarmingUpHF}
            isMechanicalVentilation={props.isMechanicalVentilation}
            isHighFlowMode={isIcuMode && props.icuSubMode === 'high-flow'}
            operatingMode={props.operatingMode}
            icuSubMode={props.icuSubMode}
            currentMode={props.currentMode}
            currentTheme={props.currentTheme}
            parameters={props.parameters}
            ventilatorData={props.ventilatorData}
            areWaveformsFrozen={props.areWaveformsFrozen}
            activeManeuver={props.activeManeuver}
            onToggleFreezeWaveforms={props.onToggleFreezeWaveforms}
            currentSweepSpeedValue={props.currentSweepSpeedValue}
            scanlinePixelRate={props.scanlinePixelRate}
            onChangeSweepSpeed={props.onChangeSweepSpeed}
        />
        <RightPanel
          parameters={props.parameters}
          currentMode={props.currentMode}
          operatingMode={props.operatingMode}
          icuSubMode={props.icuSubMode}
          currentTheme={props.currentTheme}
          patientSettings={props.patientSettings}
          alarmSettings={props.alarmSettings}
          activeAlarms={props.activeAlarms}
          isAnesthesiaActive={props.isAnesthesiaActive && showAnesthesiaFeatures}
          selectedAnestheticGases={props.selectedAnestheticGases}
          isVentilationActive={props.isVentilationActive}
          isWarmingUpHF={props.isWarmingUpHF} 
          isMechanicalVentilation={props.isMechanicalVentilation}
          maneuverResultsPackage={props.maneuverResultsPackage}
          onClearManeuverResults={props.onClearManeuverResults} // Pass down
          onToggleVentilation={props.onToggleVentilation}
          onO2Flush={props.onO2Flush}
          onSetMechanicalVentilationMode={props.onSetMechanicalVentilationMode} // Pass updated prop
          onOpenParameterModal={props.onOpenParameterModal}
        />
      </main>

      <Footer />
    </div>
  );
};