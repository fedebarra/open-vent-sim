
import React, { useState, useEffect, useCallback } from 'react';
import { OperatingMode, ICUSubMode } from '../types';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path
import { Footer } from './Footer'; // Import the common Footer

interface StartupScreenProps {
  onSelectMode: (mode: OperatingMode, subMode?: ICUSubMode) => void;
  onOpenSimulatorSettings: () => void;
  onOpenManualModal: () => void;
  onToggleRecording: () => void;
  isRecordingEnabled: boolean;
}

interface ModeButtonProps {
  label: string;
  onClick: () => void;
  colorScheme: 'teal' | 'blue' | 'grey';
}

const ModeButton: React.FC<ModeButtonProps> = ({label, onClick, colorScheme}) => {
  const baseClasses = `w-full md:w-80 h-20 md:h-24 rounded-lg text-xl md:text-2xl
                       font-semibold
                       flex items-center justify-center shadow-lg shadow-black/50
                       transition-all duration-300 ease-in-out
                       hover:scale-105 active:scale-95 my-3`;

  const tealScheme = `bg-gradient-to-br from-teal-600 to-teal-700 border-2 border-teal-800 text-white
                     hover:shadow-xl hover:shadow-teal-500/50 hover:from-teal-500 hover:to-teal-600`;
  const blueScheme = `bg-gradient-to-br from-sky-600 to-sky-700 border-2 border-sky-800 text-white
                      hover:shadow-xl hover:shadow-sky-500/50 hover:from-sky-500 hover:to-sky-600`;
  const greyScheme = `bg-gradient-to-br from-neutral-600 to-neutral-700 border-2 border-neutral-800 text-white
                      hover:shadow-xl hover:shadow-neutral-500/50 hover:from-neutral-500 hover:to-neutral-600`;


  let selectedScheme = '';
  if (colorScheme === 'teal') selectedScheme = tealScheme;
  else if (colorScheme === 'blue') selectedScheme = blueScheme;
  else if (colorScheme === 'grey') selectedScheme = greyScheme;


  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${selectedScheme}`}
      title={label}
    >
      <span>{label}</span>
    </button>
  );
};

const LanguageFlagButton: React.FC<{flagEmoji: string, onClick: () => void, isActive: boolean, title: string}> = ({flagEmoji, onClick, isActive, title}) => (
  <button
    onClick={onClick}
    title={title}
    className={`px-2.5 py-1.5 mx-1.5 rounded-md text-lg transition-all duration-200
                ${isActive
                  ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-400 ring-offset-1 ring-offset-gray-800 scale-110'
                  : 'bg-gray-600 hover:bg-gray-500 opacity-75 hover:opacity-100'}`}
  >
    {flagEmoji}
  </button>
);

const UtilityIconButton: React.FC<{onClick: () => void, title: string, children: React.ReactNode, isActive?: boolean, activeColorClass?: string}> =
  ({onClick, title, children, isActive = false, activeColorClass = 'bg-red-500'}) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-10 h-10 md:w-12 md:h-12 rounded-full text-xl md:text-2xl
                   ${isActive ? activeColorClass : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                   border-2 border-gray-600 shadow-md hover:shadow-lg active:scale-95 transition-all duration-200
                   flex items-center justify-center`}
        aria-label={title}
    >
        {children}
    </button>
);

interface RecordSessionButtonProps {
  onClick: () => void;
  title: string;
  isRecordingEnabled: boolean;
  buttonText: string;
}

const RecordSessionButton: React.FC<RecordSessionButtonProps> =
  ({onClick, title, isRecordingEnabled, buttonText }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-full md:w-72 h-14 rounded-lg text-base font-semibold
                   ${isRecordingEnabled
                     ? 'bg-red-600 hover:bg-red-700 text-white animate-custom-pulse border-2 border-red-400' // Active state
                     : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-2 border-red-500'} // Inactive state with red border
                   shadow-md hover:shadow-lg active:scale-95 transition-all duration-200
                   flex items-center justify-center gap-2`}
        aria-label={title}
    >
        {/* Emoji is now part of the buttonText from translations */}
        <span>{buttonText}</span>
    </button>
);


export const StartupScreen: React.FC<StartupScreenProps> = ({ onSelectMode, onOpenSimulatorSettings, onOpenManualModal, onToggleRecording, isRecordingEnabled }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const recordButtonText = isRecordingEnabled ? t.recordButtonText_recording : t.recordSessionButtonLabel;

  const updateFullscreenStatus = useCallback(() => {
    setIsFullscreen(document.fullscreenElement != null);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', updateFullscreenStatus);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenStatus);
    };
  }, [updateFullscreenStatus]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col justify-between items-stretch z-[2000] transition-opacity duration-500 ease-in-out p-4">
      
      {/* Main Content Area */}
      <div className="flex-grow flex flex-col justify-center items-center text-center pt-10 md:pt-0"> {/* Added padding top for small screens */}
        <div className="mb-6">
            <div className="flex items-center justify-center mb-3">
              <h1 className="text-5xl md:text-7xl font-bold text-white" style={{textShadow: '2px 2px 8px rgba(255, 255, 255, 0.3)'}}>
                {t.startupTitle}
              </h1>
            </div>
            <p className="text-xl md:text-3xl text-gray-300">{t.startupSubtitle}</p>
        </div>

        <div className="w-1/2 md:w-1/3 mx-auto border-b border-gray-600 my-8"></div>

        <div className="flex flex-col items-center">
            <p className="text-lg md:text-xl text-gray-400 mb-4">{t.selectOperatingModeTitle}</p>
            <ModeButton
            label={t.anesthesiaModeName}
            onClick={() => onSelectMode('anesthesia')}
            colorScheme="teal"
            />
            <ModeButton
            label={t.intensiveCareModeName}
            onClick={() => onSelectMode('icu')}
            colorScheme="blue"
            />
            <ModeButton
            label={t.highFlowOxygenatorButton}
            onClick={() => onSelectMode('icu', 'high-flow')}
            colorScheme="grey"
            />

            <div className="mt-8 mb-4 w-full md:w-auto">
                 <RecordSessionButton
                    onClick={onToggleRecording}
                    title={isRecordingEnabled ? t.recordButtonTooltip_active : t.recordButtonTooltip_start}
                    isRecordingEnabled={isRecordingEnabled}
                    buttonText={recordButtonText}
                />
            </div>
        </div>
      </div>

      {/* Bottom Utility Bar: Language Buttons and Utility Icons */}
      <div className="flex justify-center items-center space-x-6 mb-3 md:mb-4">
        {/* Utility Icons Group */}
        <div className="flex space-x-3">
            <UtilityIconButton onClick={onOpenManualModal} title={t.manualButtonTooltip}>
                📖
            </UtilityIconButton>
            <UtilityIconButton onClick={onOpenSimulatorSettings} title={t.settingsButtonTooltip}>
                ⚙️
            </UtilityIconButton>
            <UtilityIconButton 
                onClick={handleToggleFullscreen} 
                title={isFullscreen ? t.exitFullscreenTooltip : t.enterFullscreenTooltip}
            >
                {isFullscreen ? t.fullscreenIconExit : t.fullscreenIconEnter}
            </UtilityIconButton>
        </div>
        {/* Language Buttons Group */}
        <div className="flex items-center">
            <LanguageFlagButton flagEmoji="🇬🇧" onClick={() => setLanguage('en')} isActive={language === 'en'} title="English" />
            <LanguageFlagButton flagEmoji="🇮🇹" onClick={() => setLanguage('it')} isActive={language === 'it'} title="Italiano" />
        </div>
      </div>

      <Footer />
    </div>
  );
};
