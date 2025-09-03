
import React from 'react';
import { ParameterItem } from './ParameterItem';
import { VentilationMode, AnestheticGasType, ParameterKey, AllParameters, OperatingMode, ICUSubMode, PatientSettings, AlarmSettings, AlarmParameterKey, ManeuverResultsPackage, ManeuverDisplayParameter, ThemeName } from '../types';
import { PARAMETER_DEFINITIONS, GAS_CONFIG, THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';
import { TranslationKeys } from '../src/i18n/locales';
import { VentilationModeSwitcher } from './VentilationModeSwitcher';


interface RightPanelProps {
  parameters: AllParameters;
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  patientSettings: PatientSettings;
  alarmSettings: AlarmSettings;
  activeAlarms: Partial<Record<AlarmParameterKey, boolean>>;
  isAnesthesiaActive: boolean;
  selectedAnestheticGases: AnestheticGasType[];
  isVentilationActive: boolean;
  isWarmingUpHF: boolean;
  isMechanicalVentilation: boolean;
  maneuverResultsPackage: ManeuverResultsPackage | null;
  onClearManeuverResults: () => void; // New
  onToggleVentilation: () => void;
  onO2Flush: () => void;
  onSetMechanicalVentilationMode: (isMechanical: boolean) => void;
  onOpenParameterModal: (paramKey: ParameterKey, label: string, currentValue: string | number, unit: string) => void;
}

const PanelTitle: React.FC<{ children: React.ReactNode, theme: ThemeName, className?: string, showCloseButton?: boolean, onClose?: () => void }> =
  ({ children, theme, className = '', showCloseButton, onClose }) => {
  const themeColors = THEME_CONFIG[theme];
  return (
    <div className={`flex justify-between items-center text-lg font-bold mb-3 text-white border-b-2 border-gray-700 pb-2 ${className}`}>
      <span>{children}</span>
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className={`text-gray-400 hover:text-white transition-colors text-2xl leading-none`}
          aria-label="Close Results"
          title="Close Results"
        >
          &times;
        </button>
      )}
    </div>
  );
};

const ParameterGroup: React.FC<{ titleKey?: TranslationKeys; children: React.ReactNode; isEmpty?: boolean, theme: ThemeName, className?: string }> = ({ titleKey, children, isEmpty, theme, className = "" }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[theme];
  if (isEmpty) return null;
  return (
    <div className={`mb-3 ${className}`}>
      {titleKey && <h3 className={`text-sm text-gray-400 mb-2 uppercase tracking-wider font-semibold`}>{t[titleKey]}</h3>}
      {children}
    </div>
  );
};

// Generic Rectangular Action Button for Anesthesia specific actions (O2 Flush, etc.)
const RectangularActionButton: React.FC<{ text: string; onClick: () => void; className?: string; disabled?: boolean; }> =
  ({ text, onClick, className = '', disabled = false}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-14 text-base font-semibold text-white rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all duration-200 ease-in-out ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {text}
    </button>
  );
};

// Main Start/Standby button for ICU/HF modes, now rectangular
const RectangularMainActionButton: React.FC<{
  text: string;
  onClick: () => void;
  isActiveAppearance: boolean; // True for "Start" appearance (e.g., green/theme color), False for "Standby" (e.g., yellow)
  themeColors: typeof THEME_CONFIG[ThemeName];
  className?: string;
  disabled?: boolean; // Added disabled prop
}> = ({ text, onClick, isActiveAppearance, themeColors, className = '', disabled = false }) => {

  const startClasses = `bg-gradient-to-r ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} ${themeColors.textOnPrimary}`;
  const standbyClasses = `bg-yellow-500 hover:bg-yellow-600 text-black`;

  const currentClasses = isActiveAppearance ? startClasses : standbyClasses;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={text}
      aria-label={text}
      className={`w-full h-16 text-lg md:text-xl rounded-lg font-bold transition-all duration-300 ease-in-out shadow-xl hover:scale-105 active:scale-95
                  border-2 border-transparent
                  flex flex-col items-center justify-center ${currentClasses} focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-${themeColors.ring} ${className}
                  ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span className="text-lg md:text-xl">{text.toUpperCase()}</span>
    </button>
  );
};


const ManeuverResultItem: React.FC<{ parameter: ManeuverDisplayParameter, themeColors: typeof THEME_CONFIG[ThemeName] }> = ({ parameter, themeColors }) => {
  const { t } = useLanguage();
  return (
    <div className="flex justify-between items-center text-xs p-1.5 bg-gray-700/50 rounded">
      <span className={`text-gray-300`}>{t[parameter.labelKey]}</span>
      <span className={`font-semibold text-white`}>{parameter.result.value} {t[parameter.result.unitKey]}</span>
    </div>
  );
};


export const RightPanel: React.FC<RightPanelProps> = (props) => {
  const {
    parameters, currentMode, operatingMode, icuSubMode, currentTheme, patientSettings,
    alarmSettings, activeAlarms, isAnesthesiaActive, selectedAnestheticGases,
    isVentilationActive, isWarmingUpHF, isMechanicalVentilation,
    maneuverResultsPackage, onClearManeuverResults,
    onToggleVentilation, onO2Flush, onSetMechanicalVentilationMode,
    onOpenParameterModal
  } = props;
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  const showAnesthesiaMechanicalMonitors = operatingMode === 'anesthesia' && isMechanicalVentilation;
  const showIcuMonitors = operatingMode === 'icu' && (icuSubMode === 'invasive' || icuSubMode === 'non-invasive');
  const isHighFlowOnly = operatingMode === 'icu' && icuSubMode === 'high-flow';

  let ventilationButtonTextKey: TranslationKeys = isVentilationActive ? 'standbyVentilationButton' : 'startVentilationButton';
  // For RectangularMainActionButton: isActiveAppearance is true for "Start" (green/theme), false for "Standby" (yellow)
  let ventilationButtonIsActiveAppearance = !isVentilationActive;

  if (isHighFlowOnly) {
    ventilationButtonTextKey = isWarmingUpHF || isVentilationActive ? 'standbyOxygenationButton' : 'startOxygenationButton';
    ventilationButtonIsActiveAppearance = !(isWarmingUpHF || isVentilationActive);
  }

  const anesthesiaVentilationButtonText = isVentilationActive ? t.standbyVentilationButton : t.startVentilationButton;
  // For Anesthesia, isActiveAppearance for RectangularMainActionButton:
  // true when it should show "Start" state (theme color), false for "Standby" state (yellow)
  const anesthesiaStartButtonIsActiveAppearance = !isVentilationActive;


  const renderParameter = (
        key: ParameterKey,
        isCalculatedParam: boolean = false,
        customLabel?: string,
        customValueColorHex?: string,
        customAlarmKey?: AlarmParameterKey
    ) => {
    const definition = PARAMETER_DEFINITIONS[key];
    if (!definition) return null;

    // Determine if we are in ICU Invasive/Non-Invasive standby
    const isStandbyAndIcuVentMode = !isVentilationActive &&
                                   operatingMode === 'icu' &&
                                   (icuSubMode === 'invasive' || icuSubMode === 'non-invasive');

    // List of measured parameters that should show "N/A" in standby for ICU Invasive/Non-Invasive
    const measuredKeysInStandby: ParameterKey[] = [
        'pPeak', 'pPlateau', 'pMean',
        'volumeMinute', 'volumeInspired', 'volumeExpired', 'mlPerKg',
        'measuredFrequency', 'tiTtot', 'leakPercentage',
        // 'compliance', 'resistance' // If these were to be displayed here
    ];

    let valueToDisplay = (parameters as any)[key];

    if (isStandbyAndIcuVentMode && measuredKeysInStandby.includes(key)) {
        valueToDisplay = t.valueNotAvailable;
    } else if (key === 'mlPerKg' && valueToDisplay !== t.valueNotAvailable) {
      // If mlPerKg is calculated in App.tsx as 0 or '--' when VTe is 0 or no weight,
      // this specific check might be simplified if parameters.mlPerKg already reflects "N/A"
      if (!patientSettings.weight || Number(parameters.volumeExpired) === 0) {
         // parameters.mlPerKg from App.tsx should already be t.valueNotAvailable or 0
         // If parameters.mlPerKg is 0, and we want to show "N/A", this line ensures it.
         if (valueToDisplay === 0 || valueToDisplay === "0") {
            valueToDisplay = t.valueNotAvailable;
         }
      }
    }


    if (!customLabel && definition.displayCondition && !definition.displayCondition(currentMode, operatingMode ?? undefined, icuSubMode ?? undefined, !!isMechanicalVentilation)) {
        return null;
    }

    let alarmAssociationKeyToUse = customAlarmKey || undefined;
    if (!alarmAssociationKeyToUse && key === 'frequency' && operatingMode !== 'anesthesia') {
        alarmAssociationKeyToUse = 'measuredFrequency';
    }


    return (
      <ParameterItem
        key={customLabel ? `${key}-${customLabel}` : key}
        paramKey={key}
        currentValue={valueToDisplay}
        currentTheme={currentTheme}
        onClick={definition.isEditable && !isCalculatedParam ? onOpenParameterModal : undefined}
        overrideLabel={customLabel}
        valueColorHex={customValueColorHex}
        alarmSettings={alarmSettings}
        activeAlarms={activeAlarms}
        operatingMode={operatingMode}
        icuSubMode={icuSubMode}
        alarmAssociationKey={alarmAssociationKeyToUse}
      />
    );
  };

  let primaryMonitors: ParameterKey[] = [];
  let secondaryMonitors: ParameterKey[] = [];
  let hfMonitors: ParameterKey[] = [];

  if (showAnesthesiaMechanicalMonitors) {
    primaryMonitors = ['pPeak', 'pPlateau', 'pMean'];
    secondaryMonitors = ['volumeMinute', 'volumeInspired', 'volumeExpired', 'mlPerKg', 'measuredFrequency', 'tiTtot'];
  } else if (showIcuMonitors) {
    primaryMonitors = ['pPeak', 'pPlateau', 'pMean'];
    secondaryMonitors = ['volumeMinute', 'volumeExpired', 'mlPerKg', 'measuredFrequency', 'tiTtot', 'leakPercentage']; // Removed compliance, resistance
  } else if (isHighFlowOnly) {
     hfMonitors = ['waterLevelPercent', 'deliveredTemperature', 'lastDisinfectionStatus'];
  }


  return (
    <div className={`bg-gray-900 p-2 md:p-3 flex flex-col h-full`}>


      <div className="overflow-y-auto flex-grow mb-3 pr-1">
        {maneuverResultsPackage ? (
           <div className="mb-3 p-2 bg-gray-800/50 rounded-lg">
            <PanelTitle
              theme={currentTheme}
              showCloseButton={true}
              onClose={onClearManeuverResults}
              className="mb-1"
            >
                {t[maneuverResultsPackage.titleKey]}
            </PanelTitle>
            {maneuverResultsPackage.parameters.map((param, index) => (
              <ManeuverResultItem key={index} parameter={param} themeColors={themeColors} />
            ))}
          </div>
        ) : (
          <PanelTitle theme={currentTheme}>{t.panelMonitoring}</PanelTitle>
        )}


        {(showAnesthesiaMechanicalMonitors || showIcuMonitors) && (
            <>
                <ParameterGroup titleKey="groupPressures" theme={currentTheme} isEmpty={primaryMonitors.map(k => renderParameter(k)).filter(Boolean).length === 0}>
                    {primaryMonitors.map(k => renderParameter(k))}
                </ParameterGroup>
                <ParameterGroup titleKey="groupVentilationMon" theme={currentTheme} isEmpty={secondaryMonitors.map(k => renderParameter(k)).filter(Boolean).length === 0}>
                    {secondaryMonitors.map(k => renderParameter(k))}
                </ParameterGroup>
            </>
        )}

        {showAnesthesiaMechanicalMonitors && (
            <ParameterGroup titleKey="groupGasMon" theme={currentTheme}>
              {renderParameter('inspiratoryCo2')}
              {selectedAnestheticGases[0] && GAS_CONFIG[selectedAnestheticGases[0]] && (
                renderParameter(
                  'etAgentConcentration',
                  false,
                  `Et-${GAS_CONFIG[selectedAnestheticGases[0]].label}`,
                  GAS_CONFIG[selectedAnestheticGases[0]].color,
                  'etAgentConcentration'
                )
              )}
              {selectedAnestheticGases[0] && GAS_CONFIG[selectedAnestheticGases[0]] && (
                renderParameter(
                  'fiAgentConcentration',
                  false,
                  `Fi-${GAS_CONFIG[selectedAnestheticGases[0]].label}`,
                  GAS_CONFIG[selectedAnestheticGases[0]].color
                )
              )}
              {selectedAnestheticGases[1] && GAS_CONFIG[selectedAnestheticGases[1]] && (
                 renderParameter(
                  'etSecondaryAgentConcentration',
                  false,
                  `Et-${GAS_CONFIG[selectedAnestheticGases[1]].label}`,
                  GAS_CONFIG[selectedAnestheticGases[1]].color
                )
              )}
               {selectedAnestheticGases[1] && GAS_CONFIG[selectedAnestheticGases[1]] && (
                 renderParameter(
                  'fiSecondaryAgentConcentration',
                  false,
                  `Fi-${GAS_CONFIG[selectedAnestheticGases[1]].label}`,
                  GAS_CONFIG[selectedAnestheticGases[1]].color
                )
              )}
            </ParameterGroup>
        )}

        {isHighFlowOnly && (
            <ParameterGroup titleKey="highFlowMonitoringTitle" theme={currentTheme} isEmpty={hfMonitors.map(k => renderParameter(k)).filter(Boolean).length === 0}>
                {hfMonitors.map(k => renderParameter(k))}
            </ParameterGroup>
        )}
      </div>

      <div className="mt-auto space-y-3">
        {operatingMode === 'icu' && (
          <RectangularMainActionButton
            text={t[ventilationButtonTextKey]}
            onClick={onToggleVentilation}
            isActiveAppearance={ventilationButtonIsActiveAppearance}
            themeColors={themeColors}
          />
        )}
        {operatingMode === 'anesthesia' && (
          <>
            <VentilationModeSwitcher
              isMechanicalVentilation={isMechanicalVentilation}
              onSelectMode={onSetMechanicalVentilationMode}
              currentTheme={currentTheme}
            />
            <RectangularMainActionButton
              text={anesthesiaVentilationButtonText}
              onClick={onToggleVentilation}
              isActiveAppearance={anesthesiaStartButtonIsActiveAppearance}
              themeColors={themeColors} // Pass anesthesia theme colors
              disabled={!isMechanicalVentilation && isAnesthesiaActive}
            />
            <RectangularActionButton
              text={t.o2FlushButtonLabel}
              onClick={onO2Flush}
              className={`bg-sky-500 hover:bg-sky-600 text-white`}
              disabled={!isVentilationActive}
            />
          </>
        )}
      </div>
    </div>
  );
};
