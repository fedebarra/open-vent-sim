/**
 * Minimal replacement of the Scenario Creator monitor/sound.ts for the
 * ventilator only: the alarm loop and the browser permission dance.
 * Uses Open Vent Sim's own `alarm.mp3` (public/).
 */

export type SoundLevel = 'crisis' | 'warning' | 'inop' | 'ventilatore' | null

export interface MonitorSound {
  /** Unlocks audio. Must be called from a click handler. */
  enable: () => Promise<void>
  disable: () => void
  enabled: () => boolean
  /** The alarm level in progress; loops until it changes. */
  setAlarm: (level: SoundLevel) => void
  dispose: () => void
}

export function createMonitorSound(): MonitorSound {
  let audio: HTMLAudioElement | null = null
  let on = false
  let level: SoundLevel = null

  const ensure = () => {
    if (!audio && typeof Audio !== 'undefined') {
      audio = new Audio(new URL('alarm.mp3', window.location.href).href)
      audio.loop = true
      audio.volume = 0.65
    }
    return audio
  }
  const apply = () => {
    const a = ensure()
    if (!a) return
    if (on && level) { void a.play().catch(() => { /* not allowed yet */ }) }
    else { a.pause(); a.currentTime = 0 }
  }

  return {
    enable: async () => {
      const a = ensure()
      on = true
      if (a && !level) {
        // Unlock playback inside the user gesture, then stop at once.
        try { a.muted = true; await a.play(); a.pause(); a.currentTime = 0 } catch { /* ignore */ } finally { a.muted = false }
      }
      apply()
    },
    disable: () => { on = false; apply() },
    enabled: () => on,
    setAlarm: (next) => { if (next === level) return; level = next; apply() },
    dispose: () => { level = null; on = false; if (audio) { audio.pause(); audio.src = '' } audio = null },
  }
}
