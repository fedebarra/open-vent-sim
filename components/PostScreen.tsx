import React, { useState, useEffect } from 'react';
import { ThemeName, PostScreenKey, ICUSubMode, LastDisinfectionStatus, HighFlowInterfaceType } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext';
import { THEME_CONFIG, POST_SCREEN_CONFIG } from '../constants';
import { TranslationKeys } from '../src/i18n/locales';
import { Footer } from './Footer';

interface PostScreenProps {
  deviceTitleKey: TranslationKeys;
  lastTestTime: string | null; // ISO string or null
  lastDisinfectionStatus?: LastDisinfectionStatus | null;
  onPerformSelfTest: () => void;
  onStartup: (selectedInterface?: HighFlowInterfaceType) => void; // Modified to pass interface
  currentTheme: ThemeName;
  onExitPostScreen: () => void;
  currentPostScreenKey?: PostScreenKey;
  selectedIcuSubModeOnPostScreen?: ICUSubMode;
  onSelectIcuSubModeOnPostScreen?: (subMode: ICUSubMode) => void;
  initialHighFlowInterfaceType?: HighFlowInterfaceType; // New prop for default HF interface
  onStartDisinfectionCycle?: (postKey: PostScreenKey) => void;
}

const ActionButton: React.FC<{
  labelKey: TranslationKeys,
  onClick: () => void,
  themeColors: typeof THEME_CONFIG[ThemeName],
  primary?: boolean,
  icon?: string,
  size?: 'normal' | 'small',
  customColor?: 'yellow' | 'orange',
  disabled?: boolean;
}> = ({labelKey, onClick, themeColors, primary = false, icon, size = 'normal', customColor, disabled = false}) => {
  const { t } = useLanguage();

  const heightClasses = size === 'normal'
    ? 'h-16 md:h-20 text-lg md:text-xl'
    : 'h-12 md:h-14 text-base md:text-lg';

  const baseClasses = `w-full md:w-80 rounded-lg font-semibold
                       flex items-center justify-center shadow-lg shadow-black/50
                       transition-all duration-300 ease-in-out
                       hover:scale-105 active:scale-95 my-2.5 ${heightClasses}
                       ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  let schemeClasses = '';
  if (customColor === 'yellow') {
    schemeClasses = `bg-yellow-500 hover:bg-yellow-600 border-2 border-yellow-700 text-black
                     hover:shadow-xl hover:shadow-yellow-500/50`;
  } else if (customColor === 'orange') {
     schemeClasses = `bg-orange-500 hover:bg-orange-600 border-2 border-orange-700 text-white
                     hover:shadow-xl hover:shadow-orange-500/50`;
  } else if (primary) {
    schemeClasses = `bg-gradient-to-br ${themeColors.buttonGradientFrom} ${themeColors.buttonGradientTo} border-2 ${themeColors.border} ${themeColors.textOnPrimary}
                     hover:shadow-xl hover:shadow-${themeColors.accent}/50 hover:from-${themeColors.primaryLight} hover:to-${themeColors.primary}`;
  } else {
    schemeClasses = `bg-gray-600 hover:bg-gray-500 border-2 border-gray-700 text-gray-200
                     hover:shadow-xl hover:shadow-gray-500/30`;
  }


  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${schemeClasses}`}
      title={t[labelKey]}
      disabled={disabled}
    >
      {icon && <span className="mr-2 text-xl">{icon}</span>}
      {t[labelKey]}
    </button>
  );
};

const SubModeSelectionButton: React.FC<{
  labelKey: TranslationKeys;
  onClick: () => void;
  isSelected: boolean;
  theme: ThemeName; // Theme for this specific button
  icon?: string;
}> = ({ labelKey, onClick, isSelected, theme, icon }) => {
  const { t } = useLanguage();
  const buttonThemeColors = THEME_CONFIG[theme];

  const baseClasses = `flex-1 h-14 md:h-16 rounded-lg text-base md:text-lg font-semibold
                       flex items-center justify-center shadow-md
                       transition-all duration-200 ease-in-out border-2`;

  const selectedClasses = `bg-gradient-to-br ${buttonThemeColors.buttonGradientFrom} ${buttonThemeColors.buttonGradientTo} ${buttonThemeColors.border} ${buttonThemeColors.textOnPrimary} scale-100 ring-2 ring-offset-2 ring-offset-gray-800 ring-${buttonThemeColors.accent}`;
  const unselectedClasses = `bg-gray-600/70 hover:bg-gray-500/70 border-gray-500 text-gray-300 hover:border-gray-400 hover:scale-[1.02]`;

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
      title={t[labelKey]}
    >
      {icon && <span className="mr-2 text-xl">{icon}</span>}
      {t[labelKey]}
    </button>
  );
};


export const PostScreen: React.FC<PostScreenProps> = ({
  deviceTitleKey,
  lastTestTime,
  lastDisinfectionStatus,
  onPerformSelfTest,
  onStartup,
  currentTheme,
  onExitPostScreen,
  currentPostScreenKey,
  selectedIcuSubModeOnPostScreen,
  onSelectIcuSubModeOnPostScreen,
  initialHighFlowInterfaceType,
  onStartDisinfectionCycle,
}) => {
  const { t, language } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];
  const [selectedHfInterface, setSelectedHfInterface] = useState<HighFlowInterfaceType>(initialHighFlowInterfaceType || 'adult');

  useEffect(() => {
    if (currentPostScreenKey === 'high_flow_post') {
        setSelectedHfInterface(POST_SCREEN_CONFIG.high_flow_post.initialHighFlowInterfaceType || 'adult');
    }
  }, [currentPostScreenKey]);


  const formattedLastTestTime = lastTestTime
    ? new Date(lastTestTime).toLocaleString(language === 'it' ? 'it-IT' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : t.post_notPerformed;

  const showIcuSubModeSelection = currentPostScreenKey === 'icu_general_post' && onSelectIcuSubModeOnPostScreen;
  const showHfInterfaceSelection = currentPostScreenKey === 'high_flow_post';

  let disinfectionStatusText = '';
  let disinfectionStatusColorClass = '';
  if (currentPostScreenKey === 'high_flow_post' && lastDisinfectionStatus) {
    switch (lastDisinfectionStatus) {
      case 'clean':
        disinfectionStatusText = t.disinfectionStatus_clean;
        disinfectionStatusColorClass = 'text-green-400';
        break;
      case 'dirty':
        disinfectionStatusText = t.disinfectionStatus_dirty;
        disinfectionStatusColorClass = 'text-yellow-400';
        break;
      case 'not_safe':
        disinfectionStatusText = t.disinfectionStatus_not_safe;
        disinfectionStatusColorClass = 'text-red-400';
        break;
    }
  }

  const canRunDisinfection = currentPostScreenKey === 'high_flow_post' &&
                             (lastDisinfectionStatus === 'dirty' || lastDisinfectionStatus === 'not_safe');

  const handleStartupClick = () => {
    if (showHfInterfaceSelection) {
      onStartup(selectedHfInterface);
    } else {
      onStartup();
    }
  };


  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col justify-between items-stretch z-[1800] p-4">
       <div className="absolute top-4 left-4">
        <button
            onClick={onExitPostScreen}
            title={t.powerOffButton}
            className={`w-10 h-10 rounded-full text-white text-xl flex items-center justify-center
                        bg-gray-700 hover:bg-gray-600 border border-white/50
                        transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50`}
        >
            {t.powerOffButton}
        </button>
      </div>
      <div className="flex-grow flex flex-col justify-center items-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-8" style={{ textShadow: `2px 2px 8px ${themeColors.accent === 'teal-500' ? 'rgba(20, 184, 166, 0.5)' : themeColors.accent === 'sky-500' ? 'rgba(3, 169, 244, 0.5)' : 'rgba(160, 174, 192, 0.5)' }`}}>
          {t[deviceTitleKey]}
        </h1>

        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          {showIcuSubModeSelection && (
            <div className="mb-3 w-full">
                <p className="text-sm text-gray-300 mb-1">{t.chooseModalitySubtitle}:</p>
                <div className="flex flex-row gap-2 justify-center w-full md:w-80 mx-auto">
                    <SubModeSelectionButton
                        labelKey="invasiveVentilationButton"
                        onClick={() => onSelectIcuSubModeOnPostScreen!('invasive')}
                        isSelected={selectedIcuSubModeOnPostScreen === 'invasive'}
                        theme="icu"
                    />
                    <SubModeSelectionButton
                        labelKey="nonInvasiveVentilationButton"
                        onClick={() => onSelectIcuSubModeOnPostScreen!('non-invasive')}
                        isSelected={selectedIcuSubModeOnPostScreen === 'non-invasive'}
                        theme="nonInvasive"
                    />
                </div>
            </div>
          )}

          {showHfInterfaceSelection && (
            <div className="mb-3 w-full">
                <p className="text-sm text-gray-300 mb-1">{t.highFlowInterfaceSelectionTitle}:</p>
                <div className="flex flex-row gap-2 justify-center w-full md:w-80 mx-auto">
                    <SubModeSelectionButton
                        labelKey="highFlowInterfaceAdultButton"
                        onClick={() => setSelectedHfInterface('adult')}
                        isSelected={selectedHfInterface === 'adult'}
                        theme="highFlow"
                        icon="🧑‍🦲"
                    />
                    <SubModeSelectionButton
                        labelKey="highFlowInterfacePediatricButton"
                        onClick={() => setSelectedHfInterface('junior')}
                        isSelected={selectedHfInterface === 'junior'}
                        theme="highFlow" // Or a specific "junior" theme if created
                        icon="🧸"
                    />
                </div>
            </div>
          )}


          <ActionButton
            labelKey="post_startupButton"
            onClick={handleStartupClick}
            themeColors={themeColors}
            primary={true}
            icon={t.startupIcon}
            size="normal"
          />

          <div className={`p-3 rounded-lg bg-${themeColors.primaryDark}/30 border ${themeColors.border} w-full md:w-80`}>
            <p className={`text-xs ${themeColors.textOnPrimary} mb-1`}>{t.post_lastSelfTestLabel}</p>
            <p className={`text-base font-semibold ${themeColors.textOnPrimary}`}>{formattedLastTestTime}</p>
            {currentPostScreenKey === 'high_flow_post' && lastDisinfectionStatus && (
              <>
                <p className={`text-xs ${themeColors.textOnPrimary} mt-1.5 mb-0.5`}>{t.lastDisinfectionStatusLabel}:</p>
                <p className={`text-sm font-semibold ${disinfectionStatusColorClass}`}>{disinfectionStatusText}</p>
              </>
            )}
          </div>

           {canRunDisinfection && onStartDisinfectionCycle && currentPostScreenKey && (
            <ActionButton
                labelKey="disinfectionCycleButtonLabel"
                onClick={() => onStartDisinfectionCycle(currentPostScreenKey)}
                themeColors={themeColors}
                primary={true}
                customColor="yellow"
                size="small"
                icon="🧼"
            />
           )}

          <ActionButton
            labelKey="post_performSelfTestButton"
            onClick={onPerformSelfTest}
            themeColors={themeColors}
            primary={false}
            size="small"
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};
