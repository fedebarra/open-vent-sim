

import React from 'react';
import { OperatingMode, ICUSubMode, ThemeName, HighFlowInterfaceType, HumidifierSettings } from '../types'; 
import { TranslationKeys } from '../src/i18n/locales'; 
import { THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext'; 

interface HeaderProps {
  currentTime: Date;
  isAnesthesiaActive: boolean;
  isVentilationActive: boolean;
  isWarmingUpHF: boolean; 
  isO2FlushActive: boolean; 
  o2FlushTimerEnd: number | null;
  isRecordingActive?: boolean; 
  hasActiveAlarms: boolean; 
  isAlarmSnoozed: boolean; 
  snoozeCountdownDisplay: number | null; // New prop
  onToggleAlarmSnooze: () => void; 
  onOpenManualModal: () => void; 
  onOpenLivePatientSettingsModal: () => void;
  onPowerOff: () => void;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  highFlowInterfaceType: HighFlowInterfaceType | null;
  humidifierSettings: HumidifierSettings;
  onTogglePatientSettingsModal: () => void;
  onToggleAlarmSettingsModal: () => void;
  onBackToICUSubModeSelection: () => void; 
}

const StatusItem: React.FC<{ dotColorClass: string; label: string; animate?: boolean; dotBorderClass?: string }> = ({ dotColorClass, label, animate = true, dotBorderClass = "" }) => (
  <div className="flex items-center gap-2 text-xs text-gray-200">
    <div className={`w-2.5 h-2.5 rounded-full ${dotColorClass} ${animate ? 'animate-custom-pulse' : ''} ${dotBorderClass}`}></div>
    <span className="font-semibold">{label}</span>
  </div>
);

const HeaderIconButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  activeColorClass?: string;
  operatingMode: OperatingMode | null; // Keep for potential future use, though not directly styling now
}> =
  ({ onClick, title, children, className = '', isActive = false, activeColorClass = 'bg-green-500' }) => {

  const baseBg = 'bg-gray-700 hover:bg-gray-600';
  const finalBg = isActive ? `${activeColorClass} hover:opacity-90` : baseBg;
  
  // Standardized size and border for all HeaderIconButtons
  const standardClasses = `w-11 h-11 rounded-full border border-white/50 text-white text-xl flex items-center justify-center
                           transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50`;


  return (
    <button
      onClick={onClick}
      title={title}
      className={`${standardClasses} ${finalBg} ${className}`} // className can override or add specifics
    >
      {children}
    </button>
  );
};


export const Header: React.FC<HeaderProps> = ({
    currentTime, isAnesthesiaActive, isVentilationActive, isWarmingUpHF, isO2FlushActive, o2FlushTimerEnd, isRecordingActive,
    hasActiveAlarms, isAlarmSnoozed, snoozeCountdownDisplay, onToggleAlarmSnooze,
    onOpenManualModal, onOpenLivePatientSettingsModal, onPowerOff,
    operatingMode, icuSubMode, currentTheme, highFlowInterfaceType, humidifierSettings,
    onTogglePatientSettingsModal, onToggleAlarmSettingsModal, 
    onBackToICUSubModeSelection
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  const isHighFlowMode = operatingMode === 'icu' && icuSubMode === 'high-flow';
  const showIcuSubModeBackButton = operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive');
  const showLiveSettingsButton = (operatingMode === 'anesthesia' || (operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive')));


  const anesthesiaStatusText = isAnesthesiaActive ? t.statusOn : t.statusOff;
  const anesthesiaDotClass = isAnesthesiaActive ? `bg-${themeColors.primaryLight}` : 'bg-gray-500';
  const fullAnesthesiaStatusLabel = `${t.anesthesiaStatusLabel.toUpperCase()} ${anesthesiaStatusText.toUpperCase()}`;

  let mainSystemStatusLabel = "";
  let mainSystemDotColor = isVentilationActive ? 'bg-green-500' : 'bg-yellow-500';
  let mainSystemAnimate = isVentilationActive;

  if (operatingMode === 'anesthesia') {
    const ventilationStatusText = isVentilationActive ? t.statusOn : t.statusOff;
    mainSystemStatusLabel = `${t.ventilationStatusLabel.toUpperCase()} ${ventilationStatusText.toUpperCase()}`;
  } else if (operatingMode === 'icu') {
    if (isHighFlowMode) {
      if (isWarmingUpHF) {
        mainSystemStatusLabel = t.status_warming_up.toUpperCase();
        mainSystemDotColor = 'bg-orange-400'; // Warming color
        mainSystemAnimate = true;
      } else {
        const oxygenationStatusKey: TranslationKeys = isVentilationActive ? 'oxygenationActiveStatus' : 'oxygenationStandbyStatus';
        mainSystemStatusLabel = t[oxygenationStatusKey].toUpperCase();
        mainSystemDotColor = isVentilationActive ? 'bg-green-500' : 'bg-yellow-500';
        mainSystemAnimate = isVentilationActive;
      }
    } else { // ICU Non-HF
      const ventilationStatusKey: TranslationKeys = isVentilationActive ? 'ventilationActiveStatus' : 'ventilationStandbyStatus';
      mainSystemStatusLabel = t[ventilationStatusKey].toUpperCase();
      mainSystemDotColor = isVentilationActive ? 'bg-green-500' : 'bg-yellow-500';
      mainSystemAnimate = isVentilationActive;
    }
  }

  let modeHeaderTextKey: TranslationKeys = 'ventilatorName';
  if (operatingMode === 'anesthesia') {
    modeHeaderTextKey = 'anesthesiaMachineHeader';
  } else if (operatingMode === 'icu') {
    if (icuSubMode === 'invasive') modeHeaderTextKey = 'invasiveVentilationHeader';
    else if (icuSubMode === 'non-invasive') modeHeaderTextKey = 'nonInvasiveVentilationHeader';
    else if (icuSubMode === 'high-flow') modeHeaderTextKey = 'highFlowOxygenHeader';
    else modeHeaderTextKey = 'intensiveCareModeName';
  }
  const modeHeaderText = t[modeHeaderTextKey];

  let o2FlushDisplayLabel = t.o2FlushActiveStatus;
  if (isO2FlushActive && o2FlushTimerEnd && o2FlushTimerEnd > Date.now()) {
      const remainingSeconds = Math.max(0, Math.round((o2FlushTimerEnd - Date.now()) / 1000));
      o2FlushDisplayLabel = `${t.o2FlushActiveStatus} (${remainingSeconds}s)`;
  }
  
  const showHumidifierStatus = operatingMode === 'icu' && icuSubMode !== 'high-flow' && humidifierSettings.isOn;

  return (
    <header className={`bg-gradient-to-r ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} px-4 py-2 border-b-2 ${themeColors.border} flex justify-between items-center h-[60px] flex-shrink-0`}>
      <div className="flex items-center gap-3">
        <HeaderIconButton 
          onClick={onPowerOff} 
          title={t.powerOffButton} 
          className={`border-2 border-${themeColors.primaryDark}`}  // Specific border for power button
          operatingMode={operatingMode}
        >
          {t.powerOffButton}
        </HeaderIconButton>
        {showIcuSubModeBackButton && (
          <HeaderIconButton 
            onClick={onBackToICUSubModeSelection} 
            title={t.backButton} 
            operatingMode={operatingMode}
          >
            ◁ 
          </HeaderIconButton>
        )}
        <div className={`text-lg font-bold ${themeColors.textOnPrimary}`}>{modeHeaderText}</div>
      </div>

      <div className="flex-grow flex justify-center items-center space-x-3">
         {operatingMode && (
            <StatusItem
                dotColorClass={mainSystemDotColor}
                label={mainSystemStatusLabel}
                animate={mainSystemAnimate}
                dotBorderClass="ring-1 ring-white/70"
            />
         )}
        {operatingMode === 'anesthesia' && (
            <StatusItem
                dotColorClass={anesthesiaDotClass}
                label={fullAnesthesiaStatusLabel}
                animate={isAnesthesiaActive}
                dotBorderClass="ring-1 ring-white/70"
            />
        )}
        {showHumidifierStatus && (
          <StatusItem
            dotColorClass="bg-cyan-400"
            label={`${t.humidifierLabel.toUpperCase()}: ${humidifierSettings.temperature}°C`}
            animate={false}
            dotBorderClass="ring-1 ring-white/70"
          />
        )}
         {hasActiveAlarms && (
            <button
                onClick={onToggleAlarmSnooze}
                title={isAlarmSnoozed ? t.snoozeButton_unsnooze : t.snoozeButton_snooze}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md transition-all duration-200 ease-in-out border
                            ${
                                isAlarmSnoozed && snoozeCountdownDisplay !== null && snoozeCountdownDisplay > 0
                                ? 'bg-yellow-500 text-black border-yellow-600 hover:bg-yellow-400' // Snoozed state
                                : `bg-red-600 text-white border-red-700 hover:bg-red-500 ${!isAlarmSnoozed ? 'animate-custom-pulse' : ''}` // Active alarm state
                            }`}
            >
                {isAlarmSnoozed && snoozeCountdownDisplay !== null && snoozeCountdownDisplay > 0 ? (
                <>
                    <span>{snoozeCountdownDisplay}s</span>
                    <span>🔈</span>
                </>
                ) : (
                <>
                    <span>{t.alarmButtonActive || 'Alarm'}</span>
                    <span>🔇</span>
                </>
                )}
            </button>
        )}
        {operatingMode === 'anesthesia' && isO2FlushActive && (
          <div className="px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded animate-custom-pulse">
            {o2FlushDisplayLabel}
          </div>
        )}
        {isHighFlowMode && highFlowInterfaceType && (
            <div className={`flex items-center gap-1.5 text-xs ${themeColors.textOnPrimary} px-2 py-1 bg-${themeColors.primaryDark}/50 rounded-md shadow`}>
                <span className="text-base" role="img" aria-label={highFlowInterfaceType === 'adult' ? t.interfaceTypeLabel_Adult : t.interfaceTypeLabel_PediatricJunior}>
                    {highFlowInterfaceType === 'adult' ? '🧑‍🦲' : '🧸'}
                </span>
                <span className="font-semibold">
                    {highFlowInterfaceType === 'adult' ? t.interfaceTypeLabel_Adult : t.interfaceTypeLabel_PediatricJunior}
                </span>
            </div>
        )}
      </div>

      <div className="flex gap-2 md:gap-3 items-center">
        {isRecordingActive && (
            <div title={t.recordButtonTooltip_active} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/80 border border-red-400 shadow">
                <span className="text-white text-xs font-bold">REC</span>
                <span className="absolute w-2 h-2 top-0.5 right-0.5 bg-white rounded-full animate-custom-pulse"></span>
            </div>
        )}
        <HeaderIconButton onClick={onOpenManualModal} title={t.manualButtonTooltip} operatingMode={operatingMode}>
          📖
        </HeaderIconButton>
        {showLiveSettingsButton && (
            <HeaderIconButton onClick={onOpenLivePatientSettingsModal} title={t.livePatientSettingsTooltip} operatingMode={operatingMode}>
              ⚙️
            </HeaderIconButton>
        )}
        {!(operatingMode === 'icu' && icuSubMode === 'high-flow') && (
            <HeaderIconButton onClick={onTogglePatientSettingsModal} title={t.patientSettingsTitle} operatingMode={operatingMode}>
            {t.patientIcon}
            </HeaderIconButton>
        )}
        <HeaderIconButton onClick={onToggleAlarmSettingsModal} title={t.alarmSettingsTitle} operatingMode={operatingMode}>
          {t.alarmsIcon}
        </HeaderIconButton>
        <div className={`text-sm ${themeColors.textOnPrimary} tabular-nums`}>
          {currentTime.toLocaleTimeString( navigator.language === 'it-IT' ? 'it-IT' : 'en-US')}
        </div>
      </div>
    </header>
  );
};