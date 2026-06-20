import React from 'react';
import { AlarmParameterKey, AlarmEvent, ThemeName } from '../types';
import { ALARMABLE_PARAMETERS_CONFIG, THEME_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';

interface AlarmLogsModalProps {
  isOpen: boolean;
  activeAlarms: Partial<Record<AlarmParameterKey, boolean>>;
  alarmEvents: AlarmEvent[];
  isAlarmSnoozed: boolean;
  snoozeCountdownDisplay: number | null;
  currentTheme: ThemeName;
  onToggleAlarmSnooze: () => void;
  onClose: () => void;
}

export const AlarmLogsModal: React.FC<AlarmLogsModalProps> = ({
  isOpen,
  activeAlarms,
  alarmEvents,
  isAlarmSnoozed,
  snoozeCountdownDisplay,
  currentTheme,
  onToggleAlarmSnooze,
  onClose,
}) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme];

  if (!isOpen) return null;

  const activeAlarmKeys = (Object.keys(activeAlarms) as AlarmParameterKey[]).filter(
    (key) => activeAlarms[key]
  );

  const hasActive = activeAlarmKeys.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className={`bg-gray-800 p-5 border-2 ${themeColors.border} rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Title */}
        <h3 className={`text-lg font-semibold text-${themeColors.accent} mb-4 text-center flex items-center justify-center gap-2`}>
          🚨 {t.alarmLogsDrawerLabel || 'Alarm Logs'}
        </h3>

        {/* Active Alarms & Snooze Panel */}
        <div className="mb-4 p-4 bg-gray-900/60 rounded-lg border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              {t.alarmStatus_active || 'Active Alarms'}
            </h4>
            
            {hasActive && (
              <button
                onClick={onToggleAlarmSnooze}
                className={`px-4 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all duration-200 border cursor-pointer
                  ${
                    isAlarmSnoozed && snoozeCountdownDisplay !== null && snoozeCountdownDisplay > 0
                      ? 'bg-yellow-500 text-black border-yellow-600 hover:bg-yellow-400'
                      : 'bg-red-600 text-white border-red-700 hover:bg-red-500 animate-custom-pulse'
                  }`}
              >
                {isAlarmSnoozed && snoozeCountdownDisplay !== null && snoozeCountdownDisplay > 0 ? (
                  <>
                    <span>🔈 {t.snoozeButton_unsnooze || 'Un-snooze'} ({snoozeCountdownDisplay}s)</span>
                  </>
                ) : (
                  <>
                    <span>🔇 {t.snoozeButton_snooze || 'Snooze Alarm'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {hasActive ? (
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {activeAlarmKeys.map((key) => {
                const config = ALARMABLE_PARAMETERS_CONFIG[key];
                const label = config ? t[config.labelKey] : key;
                return (
                  <div
                    key={key}
                    className="flex justify-between items-center bg-red-950/40 border border-red-800/40 p-2.5 rounded-md text-sm text-red-200 font-medium animate-pulse"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">⚠️</span>
                      {label}
                    </span>
                    <span className="bg-red-900/80 text-white text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                      {t.alarmButtonActive || 'ALARM'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm italic">
              ✔️ {t.valueNotAvailable !== 'N/D' ? 'No active alarms' : 'Nessun allarme attivo'}
            </div>
          )}
        </div>

        {/* Alarm Logs Chronology Panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-2 px-1">
            {t.panelManeuverResults !== 'RISULTATI MANOVRA' ? 'History Log' : 'Cronologia Eventi'}
          </h4>

          <div className="border border-gray-700 bg-gray-900/30 rounded-lg overflow-hidden flex-1 flex flex-col">
            <div className="grid grid-cols-[110px_1fr_120px] bg-gray-800/80 px-4 py-2 border-b border-gray-700 text-xs font-semibold text-gray-400">
              <span>{t.timeString !== 'Ora' ? 'Time' : 'Ora'}</span>
              <span>{t.alarmNameColumnLabel || 'Alarm'}</span>
              <span className="text-right">{t.alarmActiveColumnLabel || 'Status'}</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
              {alarmEvents.length > 0 ? (
                alarmEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`grid grid-cols-[110px_1fr_120px] px-4 py-3 text-xs items-center ${
                      ev.active ? 'bg-red-500/5 text-gray-200' : 'text-gray-400 hover:bg-gray-800/10'
                    }`}
                  >
                    <span className="font-mono text-gray-400">{ev.timestamp}</span>
                    <span className="font-medium truncate pr-2">
                      {ev.alarmLabel}
                      {ev.isHigh !== null && (
                        <span className={`ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1 rounded ${
                          ev.isHigh ? 'bg-orange-950 text-orange-400' : 'bg-blue-950 text-blue-400'
                        }`}>
                          {ev.isHigh ? 'HIGH' : 'LOW'}
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      {ev.active ? (
                        <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-950/50 px-2 py-0.5 rounded border border-red-900/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                          {t.alarmStatus_active || 'ACTIVE'}
                        </span>
                      ) : (
                        <span className="text-green-400 font-medium">
                          ✔️ {ev.resolvedAt || 'Resolved'}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-500 text-sm italic">
                  {t.valueNotAvailable !== 'N/D' ? 'No recent alarm events' : 'Nessun evento registrato'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal buttons */}
        <div className="flex justify-center mt-5">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-500 transition-colors text-sm cursor-pointer"
          >
            {t.modalConfirm || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
