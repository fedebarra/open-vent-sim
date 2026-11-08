/**
 * Open Vent Sim device host: start screen → (ICU: invasive / NIV) → patient →
 * the Scenario Creator ventilator, with its engine running locally.
 *
 * In the Scenario Creator the director console owns the snapshot and the
 * device only emits actions. Here the device is its own "director of one":
 * it holds the VentIstantanea, ticks it with `battiFino` every
 * PASSO_BATTITO_SEC and applies every tap with `applica`. A classroom layer
 * can still observe it (`onSnapshot`, `onEvent`) and drive it
 * (`remoteActions`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './device.css'
import { StartupScreen } from '../components/StartupScreen'
import { IntubatedIcon, NivMaskIcon } from '../components/icons'
import { useLanguage } from '../src/contexts/LanguageContext'
import { Ventilatore } from './screens/scenario/ventilatore/Ventilatore'
import {
  PASSO_BATTITO_SEC,
  applica,
  batti,
  battiFino,
  istantaneaIniziale,
  orologio,
  statoDa,
  type VentIstantanea,
} from './screens/scenario/ventilatore/istantanea'
import { nomeAzione, type AzioneVentilatore } from './screens/scenario/ventilatore/azioni'
import { voceRegistro, NOME_PRESET, NOME_AMBIENTE } from './screens/scenario/ventilatore/nomi'
import { cambiamenti } from './screens/scenario/ventilatore/allarmi'
import { PRESET_FISIOLOGIA, type PresetFisiologia } from './screens/scenario/ventilatore/fisica'
import { DRIVE_ASSENTE, valoreRampa, type Rampa } from './screens/scenario/ventilatore/asincronie'
import type { Ambiente } from './screens/scenario/ventilatore/parametri'
import { translate } from './i18n'
import type { DeviceRemoteActions, DeviceRemoteCommand, DeviceScreen, DeviceSnapshot, EventSource } from './remoteTypes'
import { Tour } from '../tour/Tour'

export interface DeviceAppProps {
  /** Called at least twice per second while a machine is on (and on every change of screen). */
  onSnapshot?: (ist: VentIstantanea | null, info: DeviceSnapshot) => void
  /** One human-readable line per learner action, alarm on/off, or applied remote command. */
  onEvent?: (text: string, source: EventSource, kind: string) => void
  /** Commands from the director console. */
  remoteActions?: DeviceRemoteActions
  /**
   * True when linked to a director console: the learner only enters what a
   * real ventilator asks (weight, age). Lung picture and teaching traces are
   * the instructor's call and are set from the console.
   */
  linked?: boolean
  /** Optional extra start-screen hooks (recording, tour, settings, manual). */
  onToggleRecording?: () => void
  isRecordingEnabled?: boolean
  onStartTour?: () => void
  tourLabel?: string
  onOpenSimulatorSettings?: () => void
  onOpenManualModal?: () => void
}

const S = {
  it: {
    icuTitle: 'Terapia intensiva: come è collegato il paziente?',
    invasive: 'Invasiva', invasiveDesc: 'Tubo endotracheale o tracheostomia',
    niv: 'Non invasiva', nivDesc: 'Maschera o casco',
    back: '← Indietro',
    didattica: 'Mostra le tracce didattiche Palv e Pmus (non presenti su un ventilatore vero)',
    patientTitle: 'Il paziente',
    weight: 'Peso', age: 'Età', years: 'anni',
    lung: 'Polmone',
    esercitazione: 'Impostazioni dell’esercitazione',
    esercitazioneNota: 'Non ci sono su un ventilatore vero: servono a preparare il caso.',
    daRegia: 'Il quadro clinico lo decide l’istruttore dalla regia.',
    confirm: 'Accendi la macchina',
    regia: 'regia',
    tour: 'Guida passo passo',
  },
  en: {
    icuTitle: 'Intensive care: how is the patient connected?',
    invasive: 'Invasive', invasiveDesc: 'Endotracheal tube or tracheostomy',
    niv: 'Non-invasive', nivDesc: 'Mask or helmet',
    back: '← Back',
    didattica: 'Show the teaching traces Palv and Pmus (not on a real ventilator)',
    patientTitle: 'The patient',
    weight: 'Weight', age: 'Age', years: 'years',
    lung: 'Lung',
    esercitazione: 'Exercise settings',
    esercitazioneNota: 'Not on a real ventilator: they set up the case.',
    daRegia: 'The clinical picture is set by the instructor from the console.',
    confirm: 'Switch the machine on',
    regia: 'instructor',
    tour: 'Guided tour',
  },
}

const PRESETS = Object.keys(PRESET_FISIOLOGIA) as PresetFisiologia[]
const VITALI_BASE = { spo2: 97, heartRate: 78, map: 85, etco2: null as number | null }

export const DeviceApp: React.FC<DeviceAppProps> = ({
  onSnapshot, onEvent, remoteActions, linked = false,
  onToggleRecording, isRecordingEnabled = false, onStartTour, tourLabel, onOpenSimulatorSettings, onOpenManualModal,
}) => {
  const { language } = useLanguage()
  const lang: 'it' | 'en' = language === 'it' ? 'it' : 'en'
  const s = S[lang]
  // Teaching traces (Palv/Pmus): off by default; the learner can enable them
  // here when alone, the director from the console.
  const [didattica, setDidattica] = useState(false)

  const [screen, setScreen] = useState<DeviceScreen>('startup')
  const [icuChoice, setIcuChoice] = useState(false)
  const [ambiente, setAmbiente] = useState<Ambiente | null>(null)
  const [peso, setPeso] = useState(70)
  const [eta, setEta] = useState(50)
  const [preset, setPreset] = useState<PresetFisiologia>('normale')

  const [vent, setVent] = useState<VentIstantanea | null>(null)
  const ventRef = useRef<VentIstantanea | null>(null)
  ventRef.current = vent
  const rampaRef = useRef<Rampa | null>(null)
  const battutoAl = useRef<{ accesoDa: number; tSec: number } | null>(null)
  const [pienoSchermo, setPienoSchermo] = useState(false)
  // Guided tour: on/off, and the learner's recent actions it watches for "Try it".
  const [tourActive, setTourActive] = useState(false)
  const [tourActions, setTourActions] = useState<{ kind: string; at: number }[]>([])

  const cbRef = useRef({ onSnapshot, onEvent })
  cbRef.current = { onSnapshot, onEvent }
  const say = useCallback((kind: string, source: EventSource, extra?: string) => {
    const voci = voceRegistro(kind)
    const testo = voci ? voci.map((k) => translate(lang, k)).join(' · ') : kind
    cbRef.current.onEvent?.(extra ? `${testo} · ${extra}` : testo, source, kind)
  }, [lang])

  // ------------------------------------------------------------- engine --
  /** Apply an action now (learner tap or director command), with an immediate tenth-of-a-beat. */
  const esegui = useCallback((azione: AzioneVentilatore, source: EventSource) => {
    const prima = ventRef.current
    if (!prima) return
    const adesso = orologio(prima)
    const esito = applica(prima, azione, adesso)
    const dopo = batti(esito.istantanea, adesso, 0.1)
    ventRef.current = dopo
    setVent(dopo)
    if (source === 'learner') setTourActions((p) => [...p.slice(-59), { kind: nomeAzione(azione), at: Date.now() }])
    const valore = 'valore' in azione ? String((azione as { valore: unknown }).valore) : undefined
    say(nomeAzione(azione), source, [valore, source === 'director' ? S[lang].regia : undefined].filter(Boolean).join(' · ') || undefined)
    if (esito.registro) say(esito.registro, 'device')
  }, [say, lang])

  // Alarms switching on/off end up in the log, like in the Scenario Creator.
  const allarmiVisti = useRef<VentIstantanea['allarmi']>([])
  useEffect(() => {
    if (!vent) { allarmiVisti.current = []; return }
    const { accesi, spenti } = cambiamenti(allarmiVisti.current, vent.allarmi)
    allarmiVisti.current = vent.allarmi
    accesi.forEach((a) => say(`allarme:${a.chiave}${a.verso ? `:${a.verso}` : ''}`, 'device', a.valore !== null ? String(a.valore) : undefined))
    spenti.forEach((a) => say(`allarme-fine:${a.chiave}`, 'device'))
  }, [vent, say])

  // The 2-second heartbeat (catch-up included if the tab was hidden).
  const acceso = vent !== null
  useEffect(() => {
    if (!acceso) return
    const id = window.setInterval(() => {
      const corrente = ventRef.current
      if (!corrente) return
      const adesso = orologio(corrente)
      const ultimo = battutoAl.current
      const da = ultimo && ultimo.accesoDa === corrente.accesoDa ? ultimo.tSec : null
      battutoAl.current = { accesoDa: corrente.accesoDa, tSec: adesso }
      const rampa = rampaRef.current
      const finita = rampa !== null && adesso >= rampa.inizioSec + rampa.durataSec
      const dopo = battiFino(corrente, da, adesso, (ist, t) =>
        rampa ? { ...ist, drive: { ...ist.drive, frequenza: valoreRampa(rampa, t, ist.drive.frequenza) } } : ist,
      )
      if (finita) rampaRef.current = null
      ventRef.current = dopo
      setVent(dopo)
    }, PASSO_BATTITO_SEC * 1000)
    return () => window.clearInterval(id)
  }, [acceso])

  // Snapshot out, ≥ 2 per second.
  useEffect(() => {
    const id = window.setInterval(() => cbRef.current.onSnapshot?.(ventRef.current, { screen, ventilatore: ventRef.current, language: lang }), 500)
    cbRef.current.onSnapshot?.(ventRef.current, { screen, ventilatore: ventRef.current, language: lang })
    return () => window.clearInterval(id)
  }, [screen, lang])

  // ------------------------------------------------------------ remote --
  const applicaRemoto = useCallback((cmd: DeviceRemoteCommand) => {
    if (cmd.type === 'azione') { esegui(cmd.azione, 'director'); return }
    if (cmd.type === 'opzioni') { if (cmd.pressioniDidattiche !== undefined) setDidattica(cmd.pressioniDidattiche); return }
    const prima = ventRef.current
    if (!prima) return
    let ist: VentIstantanea = prima
    if (cmd.preset) {
      const p = PRESET_FISIOLOGIA[cmd.preset]
      ist = { ...ist, fisiologia: { ...p.fisiologia, preset: cmd.preset }, drive: { ...ist.drive, ...p.drive } }
    }
    if (cmd.fisiologia) ist = { ...ist, fisiologia: { ...ist.fisiologia, ...cmd.fisiologia } }
    if (cmd.drive) ist = { ...ist, drive: { ...ist.drive, ...cmd.drive } }
    if (cmd.asincronia !== undefined) ist = { ...ist, asincronia: cmd.asincronia }
    if (cmd.vitali) ist = { ...ist, paziente: { ...ist.paziente, ...cmd.vitali } }
    if (cmd.rampaFrequenza) {
      const t = orologio(ist)
      rampaRef.current = { da: ist.drive.frequenza, a: cmd.rampaFrequenza.a, inizioSec: t, durataSec: cmd.rampaFrequenza.durataSec }
    }
    const t = orologio(ist)
    const dopo = batti(ist, t, 0.1)
    ventRef.current = dopo
    setVent(dopo)
  }, [esegui])

  useEffect(() => {
    if (!remoteActions) return
    return remoteActions.subscribe((cmd) => applicaRemoto(cmd))
  }, [remoteActions, applicaRemoto])

  // ------------------------------------------------------------ screens --
  const scegli = (mode: 'anesthesia' | 'icu', sub?: string) => {
    if (mode === 'anesthesia') { setAmbiente('anestesia'); setScreen('setup') }
    else if (sub === 'high-flow') { setAmbiente('alto-flusso'); setScreen('setup') }
    else { setIcuChoice(true); setScreen('setup') }
  }

  const accendi = () => {
    if (!ambiente) return
    const p = PRESET_FISIOLOGIA[preset]
    // A patient on invasive ventilation is sedated (no drive); the others breathe.
    const respira = ambiente !== 'invasiva'
    let ist = istantaneaIniziale(ambiente, Date.now(), { pesoKg: peso, ...VITALI_BASE })
    ist = { ...ist, fisiologia: { ...p.fisiologia, preset }, drive: respira ? { ...p.drive } : { ...DRIVE_ASSENTE } }
    // High flow starts at a clinical flow, not at the anaesthesia fresh-gas default (2 l/min would alarm at once).
    if (ambiente === 'alto-flusso') ist = applica(ist, { tipo: 'parametro', chiave: 'fgf', valore: 40 }, 0).istantanea
    ist = batti(ist, 0, 0.1)
    battutoAl.current = null
    rampaRef.current = null
    ventRef.current = ist
    setVent(ist)
    setScreen('running')
    cbRef.current.onEvent?.(`${translate(lang, 'vent.log.ventilatore')} · ${translate(lang, NOME_AMBIENTE[ambiente])} · ${translate(lang, NOME_PRESET[preset])} · ${peso} kg`, 'learner', 'accensione')
  }

  const esci = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    ventRef.current = null
    setVent(null)
    setAmbiente(null)
    setIcuChoice(false)
    setScreen('startup')
    cbRef.current.onEvent?.(lang === 'it' ? 'Apparecchio spento' : 'Machine switched off', 'learner', 'spegnimento')
  }

  const togglePieno = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().then(() => setPienoSchermo(true)).catch(() => {})
    else void document.exitFullscreen().then(() => setPienoSchermo(false)).catch(() => {})
  }
  useEffect(() => {
    const f = () => setPienoSchermo(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  const clock = useCallback(() => (ventRef.current ? orologio(ventRef.current) : 0), [])
  const stato = useMemo(() => (vent ? statoDa(vent) : null), [vent])

  const tour = (
    <Tour
      active={tourActive}
      onClose={() => setTourActive(false)}
      context={{ screen, icuChoice, ambiente, vent, actions: tourActions }}
    />
  )

  const body = (() => {
  if (screen === 'running' && vent && stato) {
    return (
      <div className="ovs-device" data-testid="device-running" style={{ position: 'fixed', inset: 0, background: '#0a0f1a' }}>
        <Ventilatore
          stato={stato}
          misure={vent.misure}
          allarmi={vent.allarmi}
          limiti={vent.limiti}
          silenziatoFinoA={vent.silenziatoFinoA}
          pienoSchermo={pienoSchermo}
          onPienoSchermo={togglePieno}
          clock={clock}
          manovraDa={vent.manovraDa ?? null}
          riempimentoDa={vent.riempimentoDa ?? null}
          riempimentoCosa={vent.riempimentoCosa ?? null}
          manovraEsito={vent.manovraEsito ?? null}
          autotestMs={vent.autotestA != null ? vent.accesoDa + vent.autotestA * 1000 : null}
          operabile
          regiaViva
          onAzione={(a) => esegui(a, 'learner')}
          onEsci={esci}
          pressioniDidattiche={didattica}
        />
      </div>
    )
  }

  if (screen === 'setup' && icuChoice && !ambiente) {
    return (
      <Shell onBack={esci} back={s.back}>
        <p className="text-xl md:text-2xl text-gray-300 mb-8 text-center">{s.icuTitle}</p>
        <div className="flex flex-col sm:flex-row gap-5 justify-center">
          <Card testId="icu-invasive" onClick={() => setAmbiente('invasiva')} icon={<IntubatedIcon size={84} strokeWidth={1.3} />} title={s.invasive} desc={s.invasiveDesc}
            cls="from-sky-600 to-sky-700 border-sky-800 hover:from-sky-500 hover:to-sky-600" />
          <Card testId="icu-niv" onClick={() => setAmbiente('niv')} icon={<NivMaskIcon size={84} strokeWidth={1.3} />} title={s.niv} desc={s.nivDesc}
            cls="from-amber-600 to-amber-700 border-amber-800 hover:from-amber-500 hover:to-amber-600" />
        </div>
      </Shell>
    )
  }

  if (screen === 'setup' && ambiente) {
    return (
      <Shell onBack={esci} back={s.back}>
        <div className="w-full max-w-2xl bg-gray-800/70 border border-gray-700 rounded-2xl p-6" data-testid="patient-setup">
          <h2 className="text-2xl font-semibold text-white mb-1">{s.patientTitle}</h2>
          <p className="text-gray-400 mb-5">{translate(lang, NOME_AMBIENTE[ambiente])}</p>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Num label={s.weight} unit="kg" value={peso} min={3} max={250} onChange={setPeso} testId="patient-weight" />
            <Num label={s.age} unit={s.years} value={eta} min={0} max={110} onChange={setEta} testId="patient-age" />
          </div>
          {linked ? (
            <p className="text-gray-400 text-sm mb-6" data-testid="patient-from-director">{s.daRegia}</p>
          ) : (
            <div className="border border-dashed border-gray-600 rounded-xl p-4 mb-6" data-testid="exercise-settings">
              <div className="text-gray-200 font-semibold">{s.esercitazione}</div>
              <div className="text-gray-500 text-xs mb-3">{s.esercitazioneNota}</div>
                <div className="text-gray-300 mb-2">{s.lung}</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESETS.map((k) => (
                    <button key={k} data-testid={`patient-preset-${k}`} onClick={() => setPreset(k)}
                      className={`px-3 py-1.5 rounded-lg border ${preset === k ? 'bg-sky-700 border-sky-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-200 hover:border-gray-400'}`}>
                      {translate(lang, NOME_PRESET[k])}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer">
                  <input type="checkbox" data-testid="opt-didattica" checked={didattica} onChange={(e) => setDidattica(e.target.checked)} className="w-5 h-5 accent-sky-500" />
                  {s.didattica}
                </label>
              </div>
          )}
          <button data-testid="patient-confirm" onClick={accendi} className="w-full h-14 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-lg font-semibold shadow-lg">
            {s.confirm}
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <StartupScreen
      onSelectMode={(m, sub) => scegli(m, sub)}
      onOpenSimulatorSettings={onOpenSimulatorSettings ?? (() => {})}
      onOpenManualModal={onOpenManualModal ?? (() => {})}
      onToggleRecording={onToggleRecording ?? (() => {})}
      isRecordingEnabled={isRecordingEnabled}
      onStartTour={() => { setTourActive(true); onStartTour?.() }}
      tourLabel={tourLabel ?? s.tour}
    />
  )
  })()

  // One stable mount point: the tour keeps its step while the screens change under it.
  return (
    <>
      {body}
      {tour}
    </>
  )
}

const Shell: React.FC<{ children: React.ReactNode; onBack: () => void; back: string }> = ({ children, onBack, back }) => (
  <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-6 overflow-auto">
    <button onClick={onBack} className="absolute top-4 left-4 text-gray-300 hover:text-white">{back}</button>
    {children}
  </div>
)

const Card: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void; cls: string; testId: string }> = ({ icon, title, desc, onClick, cls, testId }) => (
  <button data-testid={testId} onClick={onClick}
    className={`w-full sm:w-64 h-28 sm:h-64 rounded-2xl bg-gradient-to-br border-2 text-white shadow-lg shadow-black/50 transition-all hover:scale-105 active:scale-95 flex sm:flex-col items-center justify-start sm:justify-center gap-4 px-6 ${cls}`}>
    <span className="shrink-0 [&>svg]:w-12 [&>svg]:h-12 sm:[&>svg]:w-20 sm:[&>svg]:h-20">{icon}</span>
    <span className="text-left sm:text-center">
      <span className="block text-2xl font-semibold">{title}</span>
      <span className="block text-sm text-white/80 mt-1">{desc}</span>
    </span>
  </button>
)

const Num: React.FC<{ label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void; testId: string }> = ({ label, unit, value, min, max, onChange, testId }) => (
  <label className="block">
    <span className="text-gray-300 text-sm">{label}</span>
    <div className="flex items-center gap-2 mt-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 rounded-lg bg-gray-700 text-white text-xl">−</button>
      <input data-testid={testId} type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n))) }}
        className="w-20 h-10 text-center rounded-lg bg-gray-900 border border-gray-600 text-white text-lg font-mono" />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 rounded-lg bg-gray-700 text-white text-xl">+</button>
      <span className="text-gray-400">{unit}</span>
    </div>
  </label>
)

export default DeviceApp
