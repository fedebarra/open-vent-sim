
import React from 'react';
import { ParameterItem } from './ParameterItem';
// AnesthesiaSection is removed
// AnesthesiaConsumables is removed
import { GasToggleButton } from './GasToggleButton';
import { InlineModeSelector } from './InlineModeSelector';
import { VentilationMode, AnestheticGasType, ParameterKey, AllParameters, OperatingMode, ICUSubMode, AlarmSettings, AlarmParameterKey, ActiveManeuver, AgentLevels, ThemeName, HumidifierSettings, GasConfig } from '../types';
import { PARAMETER_DEFINITIONS, THEME_CONFIG, GAS_CONFIG, ANESTHETIC_GAS_ORDER } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';
import { TranslationKeys } from '../src/i18n/locales';

interface LeftPanelProps {
  parameters: AllParameters;
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  selectedAnestheticGases: AnestheticGasType[];
  agentLevels: AgentLevels;
  isAnesthesiaActive: boolean;
  isVentilationActive: boolean;
  isMechanicalVentilation: boolean;
  alarmSettings: AlarmSettings;
  activeAlarms: Partial<Record<AlarmParameterKey, boolean>>;
  activeManeuver: ActiveManeuver | null;
  humidifierSettings: HumidifierSettings; // General humidifier settings
  onOpenParameterModal: (paramKey: ParameterKey, label: string, currentValue: string | number, unit: string) => void;
  onSelectGas: (gas: AnestheticGasType) => void;
  onToggleAnesthesia: () => void;
  onRefillSelectedAgents: () => void;
  onReplaceSodaLime: () => void;
  isRefillingAgents: AnestheticGasType[];
  isReplacingSodaLime: boolean;
  onSelectVentilationMode: (mode: VentilationMode) => void;
  onStartInspiratoryHold: () => void;
  onStartExpiratoryHold: () => void;
  onToggleHumidifierPower: () => void; // For general ICU humidifier
}

const PanelTitle: React.FC<{ children: React.ReactNode, theme: ThemeName, className?: string }> = ({ children, theme, className }) => {
  const themeColors = THEME_CONFIG[theme];
  return (
    <div className={`text-lg font-bold mb-3 text-white border-b-2 border-gray-700 pb-2 ${className || ''}`}>
      {children}
    </div>
  );
};

const ParameterGroup: React.FC<{ titleKey: TranslationKeys; children: React.ReactNode; isEmpty?: boolean, theme: ThemeName, className?: string }> = ({ titleKey, children, isEmpty, theme, className }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[theme];
  if (isEmpty) return null;
  return (
    <div className={`mb-4 ${className || ''}`}>
      <h3 className={`text-sm text-gray-400 mb-2 uppercase tracking-wider font-semibold`}>{t[titleKey]}</h3>
      {children}
    </div>
  );
};

const ManeuverButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled: boolean;
  themeColors: typeof THEME_CONFIG[ThemeName];
  isActive?: boolean;
}> = ({ label, onClick, disabled, themeColors, isActive }) => {
  const baseClasses = "w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white shadow-md transition-all duration-300 ease-in-out flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";

  let dynamicClasses = '';
  if (disabled && !isActive) {
    dynamicClasses = `bg-gray-500 text-gray-400 cursor-not-allowed ring-gray-400`;
  } else if (isActive) {
    dynamicClasses = `bg-yellow-500 hover:bg-yellow-600 ring-yellow-400 animate-custom-pulse`;
  } else {
    dynamicClasses = `bg-gradient-to-r ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} hover:opacity-90 ring-${themeColors.accent}`;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled && !isActive}
      className={`${baseClasses} ${dynamicClasses}`}
      title={label}
    >
      {label.toUpperCase()}
    </button>
  );
};

const PowerToggleButton: React.FC<{ // Used for general ICU humidifier
  isOn: boolean;
  onClick: () => void;
  labelOnKey: TranslationKeys;
  labelOffKey: TranslationKeys;
  themeColors: typeof THEME_CONFIG[ThemeName];
}> = ({ isOn, onClick, labelOnKey, labelOffKey, themeColors }) => {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      className={`w-full py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors duration-200 ease-in-out border-2
                  focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-${themeColors.accent}
                  ${isOn
                    ? `bg-${themeColors.primary} ${themeColors.textOnPrimary} ${themeColors.border}`
                    : `bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500`}
                `}
      title={isOn ? t[labelOnKey] : t[labelOffKey]}
    >
      {(isOn ? t[labelOnKey] : t[labelOffKey]).toUpperCase()}
    </button>
  );
};


// Local UI components for Anesthesia mode, based on removed AnesthesiaSection & AnesthesiaConsumables
const GasOptionCheckboxUi: React.FC<{
  gasKey: AnestheticGasType;
  config: Omit<GasConfig, 'name'> & { nameKey: keyof typeof GAS_CONFIG[AnestheticGasType]['nameKey'], label: string };
  isChecked: boolean;
  onChange: () => void;
  isDisabled: boolean;
  themeColors: typeof THEME_CONFIG[ThemeName];
}> = ({ gasKey, config, isChecked, onChange, isDisabled, themeColors }) => {
  const { t } = useLanguage();
  const activeBorderColor = config.color || themeColors.accent;
  const inactiveBgColor = config.color ? `${config.color}20` : `${themeColors.primaryDark}20`; // hex with alpha or tailwind with opacity
  const hoverBgColor = config.color ? `${config.color}30` : `${themeColors.primaryDark}30`;
  const textColor = config.color || themeColors.textOnPrimary;

  return (
    <label
      htmlFor={`gas-checkbox-${gasKey}`}
      className={`p-1.5 rounded-md text-xs font-bold text-center transition-all duration-300 border-2 flex items-center justify-center cursor-pointer
                  ${isChecked ? `ring-2 ring-offset-1 ring-offset-gray-700 ring-[${activeBorderColor}] bg-[${activeBorderColor}]/30 text-[${textColor}]`
                              : `border-transparent bg-[${inactiveBgColor}] text-[${textColor}]/70 hover:bg-[${hoverBgColor}]`}
                  ${isDisabled && !isChecked ? 'opacity-50 cursor-not-allowed' : ''}
                `}
      style={{ borderColor: isChecked ? activeBorderColor : 'transparent', color: isChecked ? textColor : `${textColor}B3` /* 70% opacity approx */ }}
      title={t[config.nameKey]}
    >
      <input
        type="checkbox"
        id={`gas-checkbox-${gasKey}`}
        checked={isChecked}
        onChange={onChange}
        disabled={isDisabled}
        className="sr-only"
      />
      {config.label}
    </label>
  );
};

const ConsumableIndicatorUi: React.FC<{
  label?: string; // Optional, as title might handle it
  percentage: number;
  themeColors: typeof THEME_CONFIG[ThemeName];
  isSodaLime?: boolean;
  agentGasType?: AnestheticGasType;
  isBeingProcessed?: boolean;
  processStatusKey?: 'status_refilling' | 'status_replacing';
}> = ({ label, percentage, themeColors, isSodaLime = false, agentGasType, isBeingProcessed = false, processStatusKey }) => {
  const { t } = useLanguage();
  const barHeight = 'h-3';
  let filledColorStyle = {};
  let displayPercentage = percentage;
  let outerBgClass = `bg-${themeColors.primaryDark}/30`;

  if (isSodaLime) {
    outerBgClass = 'bg-white';
    filledColorStyle = { backgroundColor: 'hsl(275, 70%, 60%)' }; // Purple for consumption
    displayPercentage = percentage; // Consumption percentage for width
  } else if (agentGasType && GAS_CONFIG[agentGasType]) {
    filledColorStyle = { backgroundColor: GAS_CONFIG[agentGasType].color };
    displayPercentage = percentage; // Agent level
  } else {
    filledColorStyle = { backgroundColor: themeColors.accent };
    displayPercentage = percentage;
  }
  const borderColorClass = isSodaLime ? 'border-gray-400' : 'border-gray-700/50';

  return (
    <div className="mb-1.5">
      <div className="flex justify-between items-center text-xs text-gray-300 mb-0.5 px-0.5">
        {label && <span className="truncate max-w-[calc(100%-70px)]">{label}</span>}
        {isBeingProcessed && processStatusKey ? (
            <span className={`text-xs font-semibold text-yellow-400 animate-custom-pulse`}>{t[processStatusKey]}</span>
        ) : (
          !isSodaLime && <span>{displayPercentage.toFixed(0)}%</span>
        )}
      </div>
      <div className={`${outerBgClass} ${barHeight} rounded-sm overflow-hidden border ${borderColorClass}`}>
        <div
          className={`${barHeight} rounded-sm transition-all duration-300 ease-in-out`}
          style={{ width: `${displayPercentage}%`, ...filledColorStyle }}
        />
      </div>
    </div>
  );
};

const ActionButtonUi: React.FC<{
  labelKey: TranslationKeys;
  onClick: () => void;
  themeColors: typeof THEME_CONFIG[ThemeName];
  disabled: boolean;
  icon?: string;
}> = ({ labelKey, onClick, themeColors, disabled, icon }) => {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-1.5 text-xs font-semibold rounded-md transition-colors
                  bg-gradient-to-r ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} ${themeColors.textOnPrimary}
                  hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-800 focus:ring-${themeColors.accent}
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-500 disabled:to-gray-400`}
      title={t[labelKey]}
    >
      {icon && <span className="mr-1 text-sm">{icon}</span>}
      {t[labelKey]}
    </button>
  );
};


export const LeftPanel: React.FC<LeftPanelProps> = (props) => {
  const {
    parameters, operatingMode, icuSubMode, currentMode, currentTheme, selectedAnestheticGases, agentLevels,
    onSelectVentilationMode, isMechanicalVentilation, isAnesthesiaActive, onToggleAnesthesia, onSelectGas,
    alarmSettings, activeAlarms,
    activeManeuver, onStartInspiratoryHold, onStartExpiratoryHold, isVentilationActive,
    onRefillSelectedAgents, onReplaceSodaLime, isRefillingAgents, isReplacingSodaLime,
    humidifierSettings, onToggleHumidifierPower, onOpenParameterModal
  } = props;
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const isHighFlowOnly = operatingMode === 'icu' && icuSubMode === 'high-flow';

  const renderParameter = (key: ParameterKey) => {
    const definition = PARAMETER_DEFINITIONS[key];
    if (!definition) return null;

    if (isHighFlowOnly && (key === 'waterLevelPercent' || key === 'lastDisinfectionStatus')) {
        return null; // These are now shown in RightPanel for HF
    }

    if (['agentRemainingPercent', 'sodaLimeRemainingPercent', 'etAgentConcentration', 'etSecondaryAgentConcentration', 'fiAgentConcentration', 'fiSecondaryAgentConcentration'].includes(key)) {
        return null; 
    }
    
    if (key === 'humidifierTemperature' && (humidifierSettings.isOn || isHighFlowOnly)) {
        return null;
    }
    
    let customLabelKey = definition.labelKey;

    if (operatingMode === 'anesthesia') {
        if (key === 'peep' && !isMechanicalVentilation) {
            customLabelKey = 'param_aplValve_label' as TranslationKeys;
        }
         if (!isMechanicalVentilation && 
            ['pPeak', 'pPlateau', 'pMean', 'compliance', 'resistance', 'measuredFrequency', 'volumeMinute', 'volumeInspired', 'volumeExpired', 'mlPerKg', 'tiTtot', 'etco2', 'spo2', 'inspiratoryCo2'].includes(key)) {
            return null; 
        }
    } else if (operatingMode === 'icu') {
        if (key === 'fgf' && icuSubMode === 'high-flow') {
            customLabelKey = 'param_fgf_high_flow_label' as TranslationKeys;
        }
        if (key === 'peep' && currentMode === VentilationMode.CPAP) { 
            customLabelKey = 'param_peep_cpap_label' as TranslationKeys;
        }
    }


    if (definition.displayCondition && 
        !definition.displayCondition(props.currentMode, operatingMode ?? undefined, icuSubMode ?? undefined, !!isMechanicalVentilation)) {
        return null;
    }

    return (
      <ParameterItem
        key={key} 
        paramKey={key} 
        currentValue={(props.parameters as any)[key]} 
        currentTheme={currentTheme}
        onClick={definition.isEditable ? props.onOpenParameterModal : undefined}
        overrideLabel={t[customLabelKey]} 
        alarmSettings={alarmSettings} 
        activeAlarms={activeAlarms}
        operatingMode={operatingMode} 
        icuSubMode={icuSubMode}
      />
    );
  };

  const isIcuInvasive = operatingMode === 'icu' && icuSubMode === 'invasive';
  const isIcuNonInvasive = operatingMode === 'icu' && icuSubMode === 'non-invasive';
  
  const showManeuvers = isIcuInvasive && isVentilationActive;
  
  const showGeneralHumidifierControls = operatingMode === 'icu' && icuSubMode !== 'high-flow';

  let panelTitleKey: TranslationKeys = 'panelVentParams';
  if (operatingMode === 'anesthesia' && !isMechanicalVentilation) {
    panelTitleKey = 'manualVentilationLabel';
  } else if (isHighFlowOnly) {
    panelTitleKey = 'highFlowSpecificParams';
  }


  let baseSettingsParamsICUInvasive: ParameterKey[] = [], ieCycleParamsICUInvasive: ParameterKey[] = [], triggerParamsICUInvasive: ParameterKey[] = [], backupParamsICUInvasive: ParameterKey[] = [];
  if (isIcuInvasive) {
    switch (currentMode) {
      case VentilationMode.VC: baseSettingsParamsICUInvasive = ['volume', 'frequency', 'peep', 'fio2']; ieCycleParamsICUInvasive = ['ratio', 'inspiratoryPausePercent']; triggerParamsICUInvasive = ['triggerFlow']; break;
      case VentilationMode.PC: baseSettingsParamsICUInvasive = ['pressureTarget', 'frequency', 'peep', 'fio2']; ieCycleParamsICUInvasive = ['ratio', 'inspiratoryRiseTimeSeconds']; triggerParamsICUInvasive = ['triggerFlow']; break;
      case VentilationMode.PS: baseSettingsParamsICUInvasive = ['psLevel', 'peep', 'fio2']; ieCycleParamsICUInvasive = ['inspiratoryRiseTimeSeconds', 'flowCycleOffPercent']; triggerParamsICUInvasive = ['triggerFlow']; backupParamsICUInvasive = ['backupPressure', 'backupFrequency', 'backupIERatio']; break;
      case VentilationMode.SIMV: baseSettingsParamsICUInvasive = ['volume', 'frequency', 'peep', 'fio2', 'psLevel']; ieCycleParamsICUInvasive = ['ratio', 'inspiratoryPausePercent', 'inspiratoryRiseTimeSeconds', 'flowCycleOffPercent']; triggerParamsICUInvasive = ['triggerFlow']; break;
      case VentilationMode.CPAP: baseSettingsParamsICUInvasive = ['peep', 'fio2']; backupParamsICUInvasive = ['backupPressure', 'backupFrequency', 'backupIERatio']; break;
    }
  }
  let baseSettingsParamsICUNonInvasive: ParameterKey[] = [], ieCycleParamsICUNonInvasive: ParameterKey[] = [], triggerParamsICUNonInvasive: ParameterKey[] = [], backupParamsICUNonInvasive: ParameterKey[] = [];
  if (isIcuNonInvasive) {
    switch (currentMode) {
      case VentilationMode.CPAP: baseSettingsParamsICUNonInvasive = ['peep', 'fio2']; backupParamsICUNonInvasive = ['backupPressure', 'backupFrequency', 'backupIERatio']; break;
      case VentilationMode.PS: baseSettingsParamsICUNonInvasive = ['psLevel', 'peep', 'fio2']; ieCycleParamsICUNonInvasive = ['inspiratoryRiseTimeSeconds', 'flowCycleOffPercent']; triggerParamsICUNonInvasive = ['triggerFlow']; backupParamsICUNonInvasive = ['backupPressure', 'backupFrequency', 'backupIERatio']; break;
    }
  }
  
  const primaryParamsAnesthesiaManual: ParameterKey[] = ['fio2', 'peep']; 
  let primaryParamsAnesthesiaMechanicalContent: (JSX.Element | null)[] = [];
  if (operatingMode === 'anesthesia' && isMechanicalVentilation) {
    primaryParamsAnesthesiaMechanicalContent.push(renderParameter('fio2'), renderParameter('peep'), renderParameter('frequency'));
    switch (currentMode) {
      case VentilationMode.VC: primaryParamsAnesthesiaMechanicalContent.push(renderParameter('volume'), renderParameter('ratio'), renderParameter('inspiratoryPausePercent')); break;
      case VentilationMode.PC: primaryParamsAnesthesiaMechanicalContent.push(renderParameter('pressureTarget'), renderParameter('ratio')); break;
      case VentilationMode.PS: primaryParamsAnesthesiaMechanicalContent.push(renderParameter('psLevel'), renderParameter('triggerFlow')); break;
    }
    primaryParamsAnesthesiaMechanicalContent = primaryParamsAnesthesiaMechanicalContent.filter(Boolean);
  }
  
  const primaryParamsHighFlow = [renderParameter('fgf'), renderParameter('fio2'), renderParameter('temperature')].filter(Boolean);


  const renderIcuInvasiveSettings = () => (
    <>
      <ParameterGroup titleKey="groupBaseSettings" theme={currentTheme} isEmpty={baseSettingsParamsICUInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{baseSettingsParamsICUInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupIESettings" theme={currentTheme} isEmpty={ieCycleParamsICUInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{ieCycleParamsICUInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupTriggerSettings" theme={currentTheme} isEmpty={triggerParamsICUInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{triggerParamsICUInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupBackupVentilation" theme={currentTheme} isEmpty={backupParamsICUInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{backupParamsICUInvasive.map(k => renderParameter(k))}</ParameterGroup>
    </>
  );
  const renderIcuNonInvasiveSettings = () => (
    <>
      <ParameterGroup titleKey="groupBaseSettings" theme={currentTheme} isEmpty={baseSettingsParamsICUNonInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{baseSettingsParamsICUNonInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupIESettings" theme={currentTheme} isEmpty={ieCycleParamsICUNonInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{ieCycleParamsICUNonInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupTriggerSettings" theme={currentTheme} isEmpty={triggerParamsICUNonInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{triggerParamsICUNonInvasive.map(k => renderParameter(k))}</ParameterGroup>
      <ParameterGroup titleKey="groupBackupVentilation" theme={currentTheme} isEmpty={backupParamsICUNonInvasive.map(k => renderParameter(k)).filter(Boolean).length === 0}>{backupParamsICUNonInvasive.map(k => renderParameter(k))}</ParameterGroup>
    </>
  );

  const anesthesiaDisplayGasText = "";
  const anesthesiaDisplayGasStyle = {};

  const agentsToDisplayForLevel = ANESTHETIC_GAS_ORDER.filter(gas => selectedAnestheticGases.includes(gas));
   if (agentsToDisplayForLevel.length === 0 && selectedAnestheticGases.length > 0) {
    agentsToDisplayForLevel.push(selectedAnestheticGases[0]);
  }

  const anyAgentNeedsRefill = selectedAnestheticGases.some(gas => (agentLevels[gas] ?? 0) < 99.9);
  const isCurrentlyProcessingAny = isRefillingAgents.length > 0 || isReplacingSodaLime;


  return (
    <div className={`bg-gray-900 flex flex-col h-full`}>
      <div className="p-2 md:p-3 overflow-y-auto flex-grow">
        
        <PanelTitle theme={currentTheme} className="mb-2">
          {t[panelTitleKey]}
        </PanelTitle>

        {operatingMode === 'anesthesia' && isMechanicalVentilation && (
            <div className="my-3">
                <InlineModeSelector
                    currentMode={currentMode}
                    operatingMode={operatingMode}
                    icuSubMode={icuSubMode}
                    currentTheme={currentTheme}
                    onSelectMode={onSelectVentilationMode}
                />
            </div>
        )}
        {(operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive') && !isHighFlowOnly) && (
          <div className="my-3">
              <InlineModeSelector
                  currentMode={currentMode}
                  operatingMode={operatingMode}
                  icuSubMode={icuSubMode}
                  currentTheme={currentTheme}
                  onSelectMode={onSelectVentilationMode}
              />
          </div>
        )}


        {operatingMode === 'anesthesia' && (
          <>
            {isMechanicalVentilation ? (
                <ParameterGroup titleKey="groupPrimaryParams" theme={currentTheme} isEmpty={primaryParamsAnesthesiaMechanicalContent.length === 0} className="mb-2">
                    {primaryParamsAnesthesiaMechanicalContent}
                </ParameterGroup>
            ) : (
                <ParameterGroup titleKey="groupPrimaryParams" theme={currentTheme} isEmpty={primaryParamsAnesthesiaManual.length === 0} className="mb-2">
                    {primaryParamsAnesthesiaManual.map(key => renderParameter(key))}
                </ParameterGroup>
            )}

            <div className={`bg-gray-800/60 border border-gray-700 rounded-lg p-3 mt-4`}>
                <PanelTitle theme={currentTheme}>{t.groupAnesthesia}</PanelTitle>
                <div className="mb-3">
                    <GasToggleButton
                        isActive={isAnesthesiaActive}
                        onClick={onToggleAnesthesia}
                        currentTheme={currentTheme}
                        disabled={!isVentilationActive && isMechanicalVentilation} // Disabled if mechanical vent is on but not started
                    />
                </div>
                
                {anesthesiaDisplayGasText && ( 
                    <div
                        className={`text-sm font-bold text-center p-1.5 rounded-md mb-2.5 transition-all duration-300`}
                        style={anesthesiaDisplayGasStyle}
                    >
                        {anesthesiaDisplayGasText}
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center mb-1.5">{t.dualAgentSelectionInfo}</p>
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                    {ANESTHETIC_GAS_ORDER.map((gasKey) => {
                        const config = GAS_CONFIG[gasKey];
                        return (
                        <GasOptionCheckboxUi
                            key={gasKey} gasKey={gasKey} config={config as any}
                            isChecked={selectedAnestheticGases.includes(gasKey)}
                            onChange={() => onSelectGas(gasKey)}
                            isDisabled={(isAnesthesiaActive && !selectedAnestheticGases.includes(gasKey) && selectedAnestheticGases.length >=2) || (isAnesthesiaActive && selectedAnestheticGases.includes(gasKey) && selectedAnestheticGases.length === 1)}
                            themeColors={themeColors}
                        />
                        );
                    })}
                </div>

                {agentsToDisplayForLevel.map(gasKey => (
                    <ConsumableIndicatorUi
                        key={`${gasKey}-level`}
                        label={`${t[GAS_CONFIG[gasKey].nameKey]}`}
                        percentage={agentLevels[gasKey] !== undefined ? agentLevels[gasKey] : 100}
                        themeColors={themeColors}
                        agentGasType={gasKey}
                        isBeingProcessed={isRefillingAgents.includes(gasKey)}
                        processStatusKey="status_refilling"
                    />
                ))}
                {selectedAnestheticGases.length > 0 && (
                    <div className="mt-1 mb-2.5">
                    <ActionButtonUi
                        labelKey="consumable_refill_button_short"
                        onClick={onRefillSelectedAgents}
                        themeColors={themeColors}
                        disabled={!anyAgentNeedsRefill || isCurrentlyProcessingAny}
                        icon="💧"
                    />
                    </div>
                )}

                <div className="space-y-2 mt-3">
                    {renderParameter('targetMac')}
                    {selectedAnestheticGases[0] && GAS_CONFIG[selectedAnestheticGases[0]] && (
                        <ParameterItem
                            key="targetEtPrimaryAgent"
                            paramKey="targetEtPrimaryAgent"
                            currentValue={parameters.targetEtPrimaryAgent}
                            currentTheme={currentTheme}
                            onClick={onOpenParameterModal}
                            overrideLabel={`Target Et-${GAS_CONFIG[selectedAnestheticGases[0]].label}`}
                            alarmSettings={alarmSettings} 
                            activeAlarms={activeAlarms}
                            operatingMode={operatingMode} 
                            icuSubMode={icuSubMode}
                        />
                    )}
                    {selectedAnestheticGases[1] && GAS_CONFIG[selectedAnestheticGases[1]] && (
                        <ParameterItem
                            key="targetEtSecondaryAgent"
                            paramKey="targetEtSecondaryAgent"
                            currentValue={parameters.targetEtSecondaryAgent}
                            currentTheme={currentTheme}
                            onClick={onOpenParameterModal}
                            overrideLabel={`Target Et-${GAS_CONFIG[selectedAnestheticGases[1]].label}`}
                            alarmSettings={alarmSettings} 
                            activeAlarms={activeAlarms}
                            operatingMode={operatingMode} 
                            icuSubMode={icuSubMode}
                        />
                    )}
                    {renderParameter('fgf')} 
                </div>

                <div className="mt-4">
                    <PanelTitle theme={currentTheme} className="text-base mb-2">{t.consumable_sodaLime_label}</PanelTitle>
                    <ConsumableIndicatorUi
                        percentage={Number(props.parameters.sodaLimeRemainingPercent)}
                        themeColors={themeColors}
                        isSodaLime={true}
                        isBeingProcessed={isReplacingSodaLime}
                        processStatusKey="status_replacing"
                    />
                    <div className="mt-1">
                        <ActionButtonUi
                        labelKey="consumable_replace_sodaLime_button"
                        onClick={onReplaceSodaLime}
                        themeColors={themeColors}
                        disabled={Number(props.parameters.sodaLimeRemainingPercent) < 0.1 || isCurrentlyProcessingAny}
                        icon="🔄"
                        />
                    </div>
                </div>
            </div>
          </>
        )}

        {operatingMode !== 'anesthesia' && (
          <>
            {isIcuInvasive ? renderIcuInvasiveSettings() :
            (isIcuNonInvasive ? renderIcuNonInvasiveSettings() :
                (isHighFlowOnly ? (
                    <ParameterGroup titleKey="groupPrimaryParams" theme={currentTheme} isEmpty={primaryParamsHighFlow.length === 0}>
                        {primaryParamsHighFlow}
                    </ParameterGroup>
                ) : null )
            )}
          </>
        )}


        {showManeuvers && (
          <div className="my-4">
            <PanelTitle theme={currentTheme}>{t.panelRespiratoryManeuvers}</PanelTitle>
            <div className="space-y-2.5">
              <ManeuverButton label={t.inspiratoryHoldButton} onClick={onStartInspiratoryHold} disabled={!isVentilationActive || activeManeuver !== null} isActive={activeManeuver === 'insp_hold'} themeColors={themeColors}/>
              <ManeuverButton label={t.expiratoryHoldButton} onClick={onStartExpiratoryHold} disabled={!isVentilationActive || activeManeuver !== null} isActive={activeManeuver === 'exp_hold'} themeColors={themeColors}/>
            </div>
          </div>
        )}

        {showGeneralHumidifierControls && (
            <div className="mt-4">
                <PanelTitle theme={currentTheme}>{t.humidifierLabel}</PanelTitle>
                <div className="space-y-2">
                    <PowerToggleButton isOn={humidifierSettings.isOn} onClick={onToggleHumidifierPower} labelOnKey="humidifierToggle_On" labelOffKey="humidifierToggle_Off" themeColors={themeColors}/>
                    {humidifierSettings.isOn && renderParameter('humidifierTemperature')}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
