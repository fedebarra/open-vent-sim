import React, { useState } from 'react';
import { GraphsPanel } from './GraphsPanel';
import { VentilationMode, AnestheticGasType, ParameterKey, AllParameters, OperatingMode, ICUSubMode, PatientSettings, AlarmSettings, HumidifierSettings, AlarmParameterKey, ActiveManeuver, ManeuverResultsPackage, AgentLevels, ThemeName, HighFlowInterfaceType, SweepSpeedValue, VentilatorData } from '../types';
import { THEME_CONFIG, PARAMETER_DEFINITIONS, VENT_MODES_CONFIG } from '../constants';
import { useLanguage } from '../src/contexts/LanguageContext';

export interface ModernVentilatorInterfaceProps {
  currentTime: Date;
  currentMode: VentilationMode;
  operatingMode: OperatingMode | null;
  icuSubMode: ICUSubMode | null;
  currentTheme: ThemeName;
  isSimulatorOn: boolean;
  isVentilationActive: boolean;
  isWarmingUpHF: boolean;
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
  snoozeCountdownDisplay: number | null;
  onToggleAlarmSnooze: () => void; 
  humidifierSettings: HumidifierSettings;
  isModeChanging: boolean;
  areWaveformsFrozen: boolean;
  activeManeuver: ActiveManeuver | null;
  maneuverResultsPackage: ManeuverResultsPackage | null;
  onClearManeuverResults: () => void;
  hasInspHold?: boolean;
  hasExpHold?: boolean;
  isO2FlushActive: boolean;
  o2FlushTimerEnd: number | null; 
  isMechanicalVentilation: boolean;
  currentSweepSpeedValue: SweepSpeedValue;
  scanlinePixelRate: number;
  onChangeSweepSpeed: () => void;
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
  onToggleAlarmLogsModal: () => void;
  onToggleHumidifierPower: () => void; 
  onToggleFreezeWaveforms: () => void;
  onStartInspiratoryHold: () => void;
  onStartExpiratoryHold: () => void;
  onO2Flush: () => void;
  onSetMechanicalVentilationMode: (isMechanical: boolean) => void;
  onBackToICUSubModeSelection: () => void;
  onOpenManualModal: () => void; 
  onOpenLivePatientSettingsModal: () => void;
  onSetHumidifierLevel?: (level: number) => void;
}

export const ModernVentilatorInterface: React.FC<ModernVentilatorInterfaceProps> = (props) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[props.currentTheme];
  const accent = themeColors.accent === 'amber-500' ? '#f59e0b' : '#36c2c8';
  const headerTitle = props.icuSubMode === 'invasive' ? t.invasiveVentilationHeader : t.nonInvasiveVentilationHeader;

  const [drawer, setDrawer] = useState<'none'|'standby'|'mode'|'maneuvers'|'humid'>('none');
  const [pendingMode, setPendingMode] = useState<VentilationMode>(props.currentMode);

  const openDrawer = (n: 'standby'|'mode'|'maneuvers'|'humid') => {
    setDrawer(drawer === n ? 'none' : n);
    setPendingMode(props.currentMode);
  };
  const closeDrawer = () => setDrawer('none');

  const confirmMode = () => {
    props.onSelectVentilationMode(pendingMode);
    setDrawer('none');
  };

  const padZero = (n: number) => n.toString().padStart(2, '0');
  const timeString = `${padZero(props.currentTime.getHours())}:${padZero(props.currentTime.getMinutes())}`;

  // Mode settings dynamically based on ICU submode / operating mode
  let modes: VentilationMode[] = [];
  if (props.operatingMode === 'icu') {
    if (props.icuSubMode === 'invasive') {
      modes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.SIMV, VentilationMode.PS];
    } else if (props.icuSubMode === 'non-invasive') {
      modes = [VentilationMode.CPAP, VentilationMode.PS];
    }
  } else if (props.operatingMode === 'anesthesia') {
    modes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.PS];
  } else {
    modes = [VentilationMode.VC, VentilationMode.PC, VentilationMode.SIMV, VentilationMode.PS];
  }

  const modeData = modes.map(m => {
    const config = VENT_MODES_CONFIG[m];
    const acronymLabel = config ? t[config.acronymKey] : String(m);
    return {
      m,
      label: acronymLabel,
      sel: () => setPendingMode(m),
      bg: pendingMode === m ? accent : '#121a28',
      fg: pendingMode === m ? '#ffffff' : '#9aa6ba',
    };
  });

  // Helper to format param
  const getParamInfo = (key: ParameterKey) => {
    const meta = PARAMETER_DEFINITIONS[key];
    const val = props.parameters[key];
    let displayVal = String(val);
    if (val !== undefined && val !== null && val !== '') {
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        displayVal = numVal % 1 !== 0 ? numVal.toFixed(1) : String(numVal);
      }
    }
    return {
      label: meta.labelKey ? t[meta.labelKey] : '',
      short: meta.labelKey ? t[meta.labelKey].substring(0, 5) : '', // Approximation for short
      unit: meta.unitKey ? t[meta.unitKey] : '',
      display: displayVal,
      alarm: false,
    };
  };

  // Determine tiles on bottom bar for current active mode
  let tileKeys: ParameterKey[] = [];
  if (props.currentMode === 'VC' || props.currentMode as any === 'VCV') tileKeys = ['volume', 'frequency', 'peep', 'fio2', 'ratio', 'inspiratoryPausePercent', 'triggerFlow'];
  else if (props.currentMode === 'PC' || props.currentMode as any === 'PCV') tileKeys = ['pressureTarget', 'frequency', 'peep', 'fio2', 'ratio', 'inspiratoryRiseTimeSeconds', 'triggerFlow'];
  else if (props.currentMode === 'SIMV') tileKeys = ['volume', 'frequency', 'peep', 'fio2', 'psLevel', 'inspiratoryPausePercent', 'triggerFlow'];
  else if (props.currentMode === 'PS' || props.currentMode as any === 'PSV') tileKeys = ['psLevel', 'peep', 'fio2', 'triggerFlow', 'inspiratoryRiseTimeSeconds', 'flowCycleOffPercent'];
  else if (props.currentMode as any === 'CPAP') tileKeys = ['peep', 'fio2'];
  
  if (tileKeys.length === 0) tileKeys = ['volume', 'frequency', 'peep', 'fio2', 'ratio', 'inspiratoryPausePercent', 'triggerFlow'];

  const bottomTiles = tileKeys.map(k => {
    const info = getParamInfo(k);
    return {
       ...info,
       active: false,
       open: () => props.onOpenParameterModal(k, info.label, props.parameters[k], info.unit),
       inc: () => {}, // Handled by Modal
       dec: () => {}
    };
  });

  // Extract variables for layout
  const venting = props.isVentilationActive;
  const statusText = venting ? t.ventilationActiveStatus || 'VENTILAZIONE: ATTIVA' : t.ventilationStandbyStatus || 'VENTILAZIONE: STANDBY';
  const statusColor = venting ? '#7fe0a6' : '#f5c451';
  const statusDot = venting ? '#46c97e' : '#f5b942';
  const statusBg = venting ? 'rgba(70,201,126,.12)' : 'rgba(245,185,66,.12)';

  const humidOn = props.humidifierSettings.isOn;

  return (
    <div style={{ position:'relative', width:'100%', height:'100vh', minHeight:'760px', background:'#0a0f1a', color:'#e9eef6', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      
      {/* TOP HEADER */}
      <div style={{ flex:'0 0 auto', height:'54px', display:'flex', alignItems:'center', gap:'14px', padding:'0 18px', background:'#0e1420', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
        <button onClick={props.onBackToICUSubModeSelection} style={{ width:'38px', height:'38px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#cdd6e4', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14 6 8 12 14 18"></polyline></svg>
        </button>
        <span style={{ fontSize:'18px', fontWeight:600, letterSpacing:'.2px' }}>{headerTitle}</span>
        <div style={{ flex:1 }}></div>
        <div style={{ display:'flex', alignItems:'center', gap:'9px', padding:'7px 15px', background:statusBg, borderRadius:'999px' }}>
          <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:statusDot, boxShadow:`0 0 9px ${statusDot}` }}></span>
          <span style={{ fontSize:'12px', fontWeight:600, letterSpacing:'.7px', color:statusColor, whiteSpace:'nowrap' }}>{statusText}</span>
        </div>
        <div style={{ flex:1 }}></div>
        
        {/* Settings button opens live patient settings as requested */}
        <button onClick={props.onOpenLivePatientSettingsModal} style={{ width:'38px', height:'38px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#cdd6e4', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} title={t.livePatientSettingsTitle}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="8" x2="20" y2="8"></line><line x1="4" y1="16" x2="20" y2="16"></line><circle cx="15" cy="8" r="2.7" fill="#0e1420"></circle><circle cx="9" cy="16" r="2.7" fill="#0e1420"></circle></svg>
        </button>
        <button 
          onClick={props.onToggleAlarmLogsModal} 
          style={{ 
            width:'38px', 
            height:'38px', 
            borderRadius:'50%', 
            background: props.hasActiveAlarms && !props.isAlarmSnoozed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,.06)', 
            border: props.hasActiveAlarms && !props.isAlarmSnoozed ? '1.5px solid #ef4444' : 'none', 
            color: props.hasActiveAlarms && !props.isAlarmSnoozed ? '#ef4444' : '#cdd6e4', 
            display:'flex', 
            alignItems:'center', 
            justifyContent:'center', 
            cursor:'pointer' 
          }} 
          className={props.hasActiveAlarms && !props.isAlarmSnoozed ? "animate-pulse" : ""}
          title={t.alarmLogsDrawerLabel || 'Alarm Logs'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={props.hasActiveAlarms && !props.isAlarmSnoozed ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path><path d="M10.3 20a2 2 0 0 0 3.4 0"></path></svg>
        </button>
        <span style={{ fontFamily:'monospace', fontSize:'15px', color:'#aeb8c8', marginLeft:'2px' }}>{timeString}</span>
      </div>

      <div style={{ flex:1, position:'relative', display:'flex', minHeight:0 }}>
        {/* GRAPHS PANEL */}
        <GraphsPanel
          {...props}
          isModernTheme={true}
          onOpenModeDrawer={() => openDrawer('mode')}
        />

        {/* MONITORING PANEL */}
        <div style={{ flex:'0 0 344px', background:'#0b111c', borderLeft:'1px solid rgba(255,255,255,.06)', display:'flex', flexDirection:'column', minHeight:0 }}>
          <div style={{ flex:'0 0 auto', padding:'13px 18px 6px' }}>
            <span style={{ fontSize:'13.5px', fontWeight:600, letterSpacing:'.4px', color:'#cdd6e4' }}>{t.panelMonitoring || 'Monitoraggio'}</span>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'0 18px 16px' }}>
            {(() => {
              const ventingActive = props.isVentilationActive;
              const formatMon = (val: any, decimals: number = 0) => {
                if (!ventingActive) return '-';
                if (val === undefined || val === null || val === '') return '-';
                if (typeof val === 'string' && isNaN(Number(val))) return val;
                const num = Number(val);
                return isNaN(num) ? '-' : num.toFixed(decimals);
              };

              const monGroup = [
                { title: t.panelPressures?.toUpperCase() || 'PRESSIONI', color:'#f2a23c', tiles:[
                  { label:'Ppeak', value: formatMon(props.parameters.pPeak, 1), unit:'cmH₂O', alarm:false },
                  { label:'Pmean', value: formatMon(props.parameters.pMean, 1), unit:'cmH₂O', alarm:false },
                  { label:'Pplat', value: formatMon(props.parameters.pPlateau, 1), unit:'cmH₂O', alarm:false },
                  { label:'PEEPtot', value: ventingActive ? String(props.parameters.peep || '0') : '-', unit:'cmH₂O', alarm:false },
                ]},
                { title: t.icuModeLabel?.toUpperCase() || 'VENTILAZIONE', color:'#46c97e', tiles:[
                  { label:'RR', value: formatMon(props.parameters.measuredFrequency, 0), unit:'/min', alarm:false },
                  { label:'MVe', value: formatMon(props.parameters.volumeMinute, 1), unit:'L/min', alarm:false },
                  { label:'I:E', value: ventingActive ? String(props.parameters.ratio || '-') : '-', unit:'', alarm:false },
                  { label:'Ti/Ttot', value: formatMon(props.parameters.tiTtot, 2), unit:'', alarm:false },
                ]},
                { title: t.panelVolumes?.toUpperCase() || 'VOLUMI', color:'#34b6ee', tiles:[
                  { label:'VTi', value: formatMon(props.parameters.volumeInspired, 0), unit:'ml', alarm:false },
                  { label:'VTe', value: formatMon(props.parameters.volumeExpired, 0), unit:'ml', alarm:false },
                  { label:'VT/kg', value: formatMon(props.parameters.mlPerKg, 1), unit:'ml/kg', alarm:false },
                ]},
                { title: t.panelMechanics?.toUpperCase() || 'MECCANICA', color:'#e9eef6', tiles:[
                  { label:'Cdyn', value: ventingActive ? String(props.parameters.compliance || '-') : '-', unit:'ml/cmH₂O', alarm:false },
                  { label:'FiO₂', value: ventingActive ? String(props.parameters.fio2 || '-') : '-', unit:'%', alarm:false },
                ]},
              ];

              return monGroup.map((g, i) => (
                <React.Fragment key={i}>
                  <div style={{ fontSize:'10.5px', letterSpacing:'1.2px', color:'#6f7c90', fontWeight:600, margin:'13px 0 7px' }}>{g.title}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    {g.tiles.map((tItem, j) => (
                      <div key={j} style={{ background:'#121a28', borderRadius:'11px', padding:'9px 11px', display:'flex', flexDirection:'column', gap:'3px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'5px', minHeight:'14px' }}>
                          {tItem.alarm && <svg width="10" height="10" viewBox="0 0 24 24" fill="#f5b942"><path d="M12 2a2 2 0 0 0-2 2v.4A7 7 0 0 0 5 11v4l-2 3v1h18v-1l-2-3v-4a7 7 0 0 0-5-6.6V4a2 2 0 0 0-2-2zM9.5 20a2.5 2.5 0 0 0 5 0z"></path></svg>}
                          <span style={{ fontSize:'11px', color:'#8a97ad', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tItem.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
                          <span style={{ fontFamily:'monospace', fontSize:'22px', fontWeight:600, lineHeight:1, color:g.color }}>{tItem.value}</span>
                          <span style={{ fontSize:'10px', color:'#6f7c90' }}>{tItem.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              ));
            })()}
          </div>
        </div>

        {/* LEFT HANDLES */}
        <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', zIndex:5, display:'flex', flexDirection:'column', gap:'10px' }}>
          {[
            { 
              id: 'standby',
              label: t.genericStandbyButtonText || 'STANDBY', 
              icon: <><path d="M12 3 v8"/><path d="M6.8 6.6 a7.5 7.5 0 1 0 10.4 0"/></>, 
              onClick: () => openDrawer('standby'),
              active: props.isVentilationActive,
              activeColor: '#46c97e',
              activeBg: 'rgba(70,201,126,.15)'
            },
            { 
              id: 'mode',
              label: t.modeLabel || 'MODALITÀ', 
              icon: <><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="8" r="2.6" fill="#141d2c"/><circle cx="9" cy="16" r="2.6" fill="#141d2c"/></>, 
              onClick: () => openDrawer('mode'),
              active: false,
              activeColor: '#46c97e',
              activeBg: 'rgba(70,201,126,.15)'
            },
            ...(props.operatingMode === 'icu' && props.icuSubMode === 'non-invasive' ? [] : [
              { 
                id: 'maneuvers',
                label: t.maneuversLabel || 'MANOVRE', 
                icon: <><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></>, 
                onClick: () => openDrawer('maneuvers'),
                active: props.activeManeuver !== null,
                activeColor: '#34b6ee',
                activeBg: 'rgba(52,182,238,.15)'
              }
            ]),
            { 
              id: 'humid',
              label: t.humidifierLabel || 'UMIDIF.', 
              icon: <><path d="M12 3 C12 3 6 10 6 14 a6 6 0 0 0 12 0 C18 10 12 3 12 3 Z"/></>, 
              onClick: () => openDrawer('humid'),
              active: props.humidifierSettings.isOn,
              activeColor: '#46c97e',
              activeBg: 'rgba(70,201,126,.15)'
            },
            {
              id: 'alarm_settings',
              label: (t.alarmSettingsDrawerLabel || 'ALLARMI').toUpperCase(),
              icon: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path><path d="M10.3 20a2 2 0 0 0 3.4 0"></path></>,
              onClick: () => {
                closeDrawer();
                props.onToggleAlarmSettingsModal();
              },
              active: false,
              activeColor: '#f59e0b',
              activeBg: 'rgba(245,158,11,.15)'
            },
          ].map((h) => {
            const isSelfOpen = drawer === h.id;
            const bg = isSelfOpen 
              ? accent 
              : h.active 
                ? h.activeBg 
                : '#141d2c';
            const fg = isSelfOpen 
              ? '#ffffff' 
              : h.active 
                ? h.activeColor 
                : '#aeb8c8';
            const borderStyle = h.active ? `3px solid ${h.activeColor}` : '0px solid transparent';
            return (
              <button key={h.id} onClick={h.onClick} style={{ 
                display:'flex', 
                flexDirection:'column', 
                alignItems:'center', 
                gap:'7px', 
                padding:'14px 10px', 
                background: bg, 
                border:'none', 
                borderLeft: borderStyle,
                borderRadius:'0 12px 12px 0', 
                color: fg, 
                cursor:'pointer', 
                boxShadow:'3px 0 14px rgba(0,0,0,.35)',
                transition:'all .2s'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">{h.icon}</svg>
                <span style={{ writingMode:'vertical-rl', fontSize:'11.5px', letterSpacing:'1.5px', fontWeight:700 }}>{h.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ flex:'0 0 auto', padding:'12px 16px 14px', background:'#0e1420', borderTop:'1px solid rgba(255,255,255,.05)', display:'flex', gap:'10px' }}>
        {bottomTiles.map((tItem, i) => (
          <div key={i} onClick={tItem.open} style={{ position:'relative', flex:1, background:'#121a28', borderRadius:'13px', padding:'11px 13px', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px', cursor:'pointer', minWidth:0 }}>
            {tItem.active && <div style={{ position:'absolute', top:0, left:'14px', right:'14px', height:'3px', borderRadius:'0 0 3px 3px', background:accent }}></div>}
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ fontSize:'12px', color:'#8a97ad', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tItem.label}</span>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:'5px' }}>
              <span style={{ fontFamily:'monospace', fontSize:'25px', fontWeight:600, color:'#e9eef6', lineHeight:1 }}>{tItem.display}</span>
              <span style={{ fontSize:'11px', color:'#7c889c' }}>{tItem.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* SCRIM */}
      {drawer !== 'none' && <div onClick={closeDrawer} style={{ position:'absolute', inset:0, background:'rgba(4,7,12,.55)', zIndex:40 }}></div>}

      {/* STANDBY DRAWER */}
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'360px', background:'#0e1521', zIndex:50, display:'flex', flexDirection:'column', boxShadow:'22px 0 60px rgba(0,0,0,.45)', transition:'transform .32s cubic-bezier(.4,0,.2,1)', transform: drawer==='standby' ? 'translateX(0)' : 'translateX(-105%)' }}>
        <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 22px 14px' }}>
          <span style={{ fontSize:'17px', fontWeight:600 }}>{t.ventilationLabel || 'Ventilazione'}</span>
          <button onClick={closeDrawer} style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#aeb8c8', fontSize:'18px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'6px 22px 26px', display:'flex', flexDirection:'column', gap:'18px' }}>
          <div style={{ background:'#121a28', borderRadius:'14px', padding:'18px', display:'flex', alignItems:'center', gap:'14px' }}>
            <span style={{ width:'12px', height:'12px', borderRadius:'50%', background:statusDot, boxShadow:`0 0 10px ${statusDot}` }}></span>
            <div>
              <div style={{ fontSize:'11px', letterSpacing:'1px', color:'#6f7c90', fontWeight:600 }}>{t.statusLabel || 'STATO'}</div>
              <div style={{ fontSize:'18px', fontWeight:600, color:statusColor, marginTop:'2px' }}>{venting ? t.ventilationActiveStatus || 'Ventilazione attiva' : t.ventilationStandbyStatus || 'In standby'}</div>
            </div>
          </div>
          <button onClick={props.onToggleVentilation} style={{ width:'100%', padding:'26px 0', background: venting ? 'linear-gradient(180deg,#f4b740,#e7a316)' : 'linear-gradient(180deg,#46c97e,#2fa564)', color: venting ? '#1a1205' : '#06150d', border:'none', borderRadius:'16px', fontSize:'17px', fontWeight:700, letterSpacing:'.5px', cursor:'pointer', boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
            {venting ? t.standbyVentilationButton || 'METTI IN STANDBY' : t.startVentilationButton || 'AVVIA VENTILAZIONE'}
          </button>
          <div style={{ fontSize:'12.5px', color:'#6f7c90', lineHeight:1.5 }}>{t.ventilationStandbyMsg || 'In standby le erogazioni si interrompono ma i parametri impostati vengono mantenuti.'}</div>
        </div>
      </div>

      {/* MODALITÀ DRAWER */}
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'404px', background:'#0e1521', zIndex:50, display:'flex', flexDirection:'column', boxShadow:'22px 0 60px rgba(0,0,0,.45)', transition:'transform .32s cubic-bezier(.4,0,.2,1)', transform: drawer==='mode' ? 'translateX(0)' : 'translateX(-105%)' }}>
        <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 22px 12px' }}>
          <span style={{ fontSize:'17px', fontWeight:600 }}>{t.modesDrawerTitle || 'Ventilation Mode'}</span>
          <button onClick={closeDrawer} style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#aeb8c8', fontSize:'18px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'2px 22px 16px' }}>
          {(() => {
            const currentModeConfig = VENT_MODES_CONFIG[props.currentMode];
            const currentModeLabel = currentModeConfig ? t[currentModeConfig.acronymKey] : String(props.currentMode);
            return (
              <div style={{ fontSize:'12px', color:'#6f7c90', marginBottom:'10px' }}>
                {t.modesDrawerActiveLabel || 'Active:'} <span style={{ color:'#e9eef6', fontWeight:600 }}>{currentModeLabel}</span>
              </div>
            );
          })()}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {modeData.map((m, i) => (
              <button key={i} onClick={m.sel} style={{ padding:'14px 0', border:'none', borderRadius:'11px', fontSize:'15px', fontWeight:700, cursor:'pointer', background:m.bg, color:m.fg }}>{m.label}</button>
            ))}
          </div>
          {(() => {
            const pendingModeConfig = VENT_MODES_CONFIG[pendingMode];
            const pendingModeLabel = pendingModeConfig ? t[pendingModeConfig.acronymKey] : String(pendingMode);
            return (
              <div style={{ fontSize:'11px', letterSpacing:'1.3px', color:'#6f7c90', fontWeight:600, margin:'22px 0 4px' }}>
                {t.modesDrawerParamsTitle || 'PARAMETERS'} · {pendingModeLabel}
              </div>
            );
          })()}
          {(() => {
              // Same mapping
              let pKeys: ParameterKey[] = [];
              if (pendingMode === 'VC' || pendingMode as any === 'VCV') pKeys = ['volume', 'frequency', 'peep', 'fio2', 'ratio', 'inspiratoryPausePercent'];
              else if (pendingMode === 'PC' || pendingMode as any === 'PCV') pKeys = ['pressureTarget', 'frequency', 'peep', 'fio2', 'ratio', 'inspiratoryRiseTimeSeconds'];
              else if (pendingMode === 'SIMV') pKeys = ['volume', 'frequency', 'peep', 'fio2', 'psLevel', 'inspiratoryPausePercent'];
              else if (pendingMode === 'PS' || pendingMode as any === 'PSV') pKeys = ['psLevel', 'peep', 'fio2', 'triggerFlow', 'inspiratoryRiseTimeSeconds'];
              else if (pendingMode as any === 'CPAP') pKeys = ['peep', 'fio2'];
              else pKeys = ['volume', 'frequency', 'peep', 'fio2'];

              return pKeys.map((pk) => {
                  const info = getParamInfo(pk);
                  return (
                      <div key={pk} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', padding:'9px 2px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                        <span style={{ fontSize:'13.5px', color:'#9aa6ba' }}>{info.label}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
                            <button onClick={() => props.onOpenParameterModal(pk, info.label, props.parameters[pk], info.unit)} style={{ padding:'6px 12px', background:'rgba(255,255,255,.08)', border:'none', borderRadius:'8px', color:'#e9eef6', cursor:'pointer' }}>{t.modalEditTitlePrefix?.trim() || 'Set'}</button>
                            <div style={{ minWidth:'74px', textAlign:'center' }}><span style={{ fontFamily:'monospace', fontSize:'15px', color:'#e9eef6', fontWeight:600 }}>{info.display}</span> <span style={{ fontSize:'11px', color:'#6f7c90' }}>{info.unit}</span></div>
                        </div>
                      </div>
                  )
              });
          })()}
        </div>
        <div style={{ flex:'0 0 auto', padding:'14px 22px 20px', borderTop:'1px solid rgba(255,255,255,.05)' }}>
          {(() => {
            const pendingModeConfig = VENT_MODES_CONFIG[pendingMode];
            const pendingModeLabel = pendingModeConfig ? t[pendingModeConfig.acronymKey] : String(pendingMode);
            return (
              <button onClick={confirmMode} style={{ width:'100%', padding:'16px 0', background:accent, color:'#fff', border:'none', borderRadius:'13px', fontSize:'14.5px', fontWeight:700, letterSpacing:'.4px', cursor:'pointer' }}>
                {t.modesConfirmAndStartButton || 'CONFIRM AND START'} · {pendingModeLabel}
              </button>
            );
          })()}
        </div>
      </div>

      {/* MANOVRE DRAWER */}
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'392px', background:'#0e1521', zIndex:50, display:'flex', flexDirection:'column', boxShadow:'22px 0 60px rgba(0,0,0,.45)', transition:'transform .32s cubic-bezier(.4,0,.2,1)', transform: drawer==='maneuvers' ? 'translateX(0)' : 'translateX(-105%)' }}>
        <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 22px 14px' }}>
          <span style={{ fontSize:'17px', fontWeight:600 }}>{t.maneuversDrawerTitle || 'Respiratory Maneuvers'}</span>
          <button onClick={closeDrawer} style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#aeb8c8', fontSize:'18px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'4px 22px 26px' }}>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={props.onStartInspiratoryHold} style={{ flex:1, padding:'16px 0', border:'none', borderRadius:'12px', background: props.activeManeuver === 'insp_hold' ? 'rgba(70,201,126,.25)' : 'rgba(47,155,245,.14)', color: props.activeManeuver === 'insp_hold'  ? '#7fe0a6' : '#7ec0ff', fontSize:'14px', fontWeight:600, cursor:'pointer', border: props.activeManeuver === 'insp_hold' ? '1px solid #46c97e' : 'none' }}>{t.inspiratoryHoldButton || 'Insp. Hold'}</button>
            <button onClick={props.onStartExpiratoryHold} style={{ flex:1, padding:'16px 0', border:'none', borderRadius:'12px', background: props.activeManeuver === 'exp_hold' ? 'rgba(70,201,126,.25)' : 'rgba(47,155,245,.14)', color: props.activeManeuver === 'exp_hold'  ? '#7fe0a6' : '#7ec0ff', fontSize:'14px', fontWeight:600, cursor:'pointer', border: props.activeManeuver === 'exp_hold' ? '1px solid #46c97e' : 'none' }}>{t.expiratoryHoldButton || 'Exp. Hold'}</button>
          </div>
          
          {props.activeManeuver && (
            <div style={{ marginTop:'14px', padding:'12px', background:'rgba(70,201,126,.1)', border:'1px solid rgba(70,201,126,.2)', borderRadius:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#46c97e' }}></span>
              <span style={{ fontSize:'12.5px', color:'#7fe0a6', fontWeight:500 }}>{t.maneuversDrawerMeasuring || 'Measurement in progress...'}</span>
            </div>
          )}

          {!props.maneuverResultsPackage && !props.activeManeuver && (
            <div style={{ marginTop:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {(!props.hasInspHold && !props.hasExpHold) && (
                <div style={{ fontSize:'12.5px', color:'#6f7c90', lineHeight:1.45 }}>
                  {t.maneuversDrawerReportHeading || "Perform both holds."}
                </div>
              )}
              {props.hasInspHold && !props.hasExpHold && (
                <div style={{ padding:'12px', background:'rgba(70,201,126,0.06)', border:'1px dashed rgba(70,201,126,0.3)', borderRadius:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#46c97e', fontSize:'13px', fontWeight:600 }}>
                    <span>✓</span> {t.maneuversDrawerInspHoldSuccess || "Inspiratory Hold completed!"}
                  </div>
                  <div style={{ fontSize:'12px', color:'#8a97ad', marginTop:'4px', lineHeight:1.4 }}>
                    {t.maneuversDrawerInspHoldTip || "Now perform Expiratory Hold."}
                  </div>
                </div>
              )}
              {props.hasExpHold && !props.hasInspHold && (
                <div style={{ padding:'12px', background:'rgba(70,201,126,0.06)', border:'1px dashed rgba(70,201,126,0.3)', borderRadius:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#46c97e', fontSize:'13px', fontWeight:600 }}>
                    <span>✓</span> {t.maneuversDrawerExpHoldSuccess || "Expiratory Hold completed!"}
                  </div>
                  <div style={{ fontSize:'12px', color:'#8a97ad', marginTop:'4px', lineHeight:1.4 }}>
                    {t.maneuversDrawerExpHoldTip || "Now perform Inspiratory Hold."}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {props.maneuverResultsPackage && (
            <div style={{ marginTop:'14px', background:'#121a28', borderRadius:'13px', padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'11.5px', fontWeight:600, letterSpacing:'.4px', color:accent }}>{t[props.maneuverResultsPackage.titleKey] || 'RISULTATI MANOVRE'}</span>
                <button onClick={props.onClearManeuverResults} style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#aeb8c8', fontSize:'14px', cursor:'pointer', lineHeight:1 }}>✕</button>
              </div>
              {props.maneuverResultsPackage.parameters.map((p, index) => {
                const labelText = t[p.labelKey] || p.labelKey;
                const unitText = t[p.result.unitKey] || p.result.unitKey;
                return (
                  <div key={index} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ fontSize:'13px', color:'#9aa6ba' }}>{labelText}</span>
                    <div style={{ display:'flex', alignItems:'baseline', gap:'10px' }}>
                      <span style={{ fontFamily:'monospace', fontSize:'15px', color:'#e9eef6', fontWeight:600, width:'55px', textAlign:'right' }}>{p.result.value}</span>
                      <span style={{ fontSize:'10px', color:'#6f7c90', fontWeight:400, width:'85px', textAlign:'left' }}>{unitText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* UMIDIFICATORE DRAWER */}
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'360px', background:'#0e1521', zIndex:50, display:'flex', flexDirection:'column', boxShadow:'22px 0 60px rgba(0,0,0,.45)', transition:'transform .32s cubic-bezier(.4,0,.2,1)', transform: drawer==='humid' ? 'translateX(0)' : 'translateX(-105%)' }}>
        <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 22px 14px' }}>
          <span style={{ fontSize:'17px', fontWeight:600 }}>{t.humidifierLabel || "UMIDIFICATORE"}</span>
          <button onClick={closeDrawer} style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,.06)', border:'none', color:'#aeb8c8', fontSize:'18px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'4px 22px 26px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'15px 16px', background:'#121a28', borderRadius:'13px' }}>
            <span style={{ fontSize:'14px', color:'#e9eef6', fontWeight:500 }}>{t.humidifierDrawerStatusLabel || 'Status'} · {humidOn ? (t.humidifierStatusOn || 'ON') : (t.humidifierStatusOff || 'OFF')}</span>
            <button onClick={props.onToggleHumidifierPower} style={{ position:'relative', width:'54px', height:'30px', borderRadius:'999px', border:'none', cursor:'pointer', background: humidOn ? accent : 'rgba(255,255,255,.15)', transition:'background .2s' }}>
              <span style={{ position:'absolute', top:'3px', left: humidOn ? '27px' : '3px', width:'24px', height:'24px', borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.4)' }}></span>
            </button>
          </div>
          {humidOn && (
            <div style={{ marginTop:'16px' }}>
              <div style={{ fontSize:'11px', letterSpacing:'1.3px', color:'#6f7c90', fontWeight:600, margin:'0 0 4px' }}>{t.humidifierDrawerSettingHeading || 'TEMPERATURE REGULATION'}</div>
              {[
                { key: 'humidifierTemperature', label: t.humidifierDrawerTempLabel || 'Circuit temperature', display: props.humidifierSettings.temperature.toString(), unit: '°C' }
              ].map((p, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', padding:'12px 2px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize:'13.5px', color:'#9aa6ba' }}>{p.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
                    <button onClick={() => props.onOpenParameterModal(p.key as ParameterKey, p.label, p.display, p.unit)} style={{ padding:'6px 12px', background:'rgba(255,255,255,.08)', border:'none', borderRadius:'8px', color:'#e9eef6', cursor:'pointer' }}>{t.modalEditTitlePrefix?.trim() || 'Set'}</button>
                    <div style={{ minWidth:'64px', textAlign:'center' }}><span style={{ fontFamily:'monospace', fontSize:'15px', color:'#e9eef6', fontWeight:600 }}>{p.display}</span> <span style={{ fontSize:'11px', color:'#6f7c90' }}>{p.unit}</span></div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop:'22px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'1.3px', color:'#6f7c90', fontWeight:600, margin:'0 0 10px' }}>{t.humidifierDrawerLevelHeading || 'HUMIDIFICATION LEVEL (1 - 5)'}</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const isSelected = (props.humidifierSettings.level || 3) === lvl;
                    return (
                      <button 
                        key={lvl} 
                        onClick={() => props.onSetHumidifierLevel?.(lvl)}
                        style={{ 
                          flex:1, 
                          padding:'11px 0', 
                          border:'none', 
                          borderRadius:'10px', 
                          fontWeight:isSelected ? 700 : 500, 
                          fontSize:'15px', 
                          cursor:'pointer', 
                          background: isSelected ? accent : 'rgba(255,255,255,.07)', 
                          color: isSelected ? '#ffffff' : '#aeb8c8',
                          boxShadow: isSelected ? `0 4px 12px ${accent}40` : 'none',
                          transition:'all .15s'
                        }}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize:'11.5px', color:'#6f7c90', marginTop:'12px', lineHeight:1.45 }}>
                  {t.humidifierDrawerLevelDescription || 'Set ideal level.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
