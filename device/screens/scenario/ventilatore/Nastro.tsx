/**
 * Il nastro: si regola qui, e niente arriva alla macchina finché non si conferma.
 *
 * Sta **sopra** la barra, sovrimpresso alle curve: la tessera toccata non cresce
 * e le altre non si spostano. I valori sono quelli che darebbero i passi della
 * manopola (`giraParametro`): passi variabili, elenchi e fermi compresi.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Translate } from '../../../i18n'
import type { StatoVentilatore } from './fisica'
import { giraParametro } from './pannello'
import { PARAMETRI, type ChiaveImpostazione } from './parametri'

/** Dopo quanti millisecondi fermi la modifica si annulla. */
export const ATTESA_CONFERMA_MS = 6000

export type ValoreImpostazione = number | string

/** Il valore a un passo di distanza, partendo da quello in attesa. */
export function passoDa(
  chiave: ChiaveImpostazione,
  stato: StatoVentilatore,
  da: ValoreImpostazione,
  verso: 1 | -1,
): ValoreImpostazione {
  const a = giraParametro(chiave, { ...stato, impostazioni: { ...stato.impostazioni, [chiave]: da } }, verso)
  return a.tipo === 'parametro' ? a.valore : da
}

/** I valori vicini, dal più basso al più alto, e dove sta quello di adesso. */
export function valoriVicini(chiave: ChiaveImpostazione, stato: StatoVentilatore, ora: ValoreImpostazione, raggio = 14) {
  const lato = (verso: 1 | -1) => {
    const v: ValoreImpostazione[] = []
    let x = ora
    for (let i = 0; i < raggio; i++) {
      const y = passoDa(chiave, stato, x, verso)
      if (y === x) break
      v.push(y)
      x = y
    }
    return v
  }
  const giu = lato(-1).reverse()
  return { valori: [...giu, ora, ...lato(1)], indice: giu.length }
}

export function Nastro({
  chiave,
  stato,
  ora,
  inAttesa,
  giri,
  scrivi,
  onValore,
  onConferma,
  t,
}: {
  key?: string | number
  chiave: ChiaveImpostazione
  stato: StatoVentilatore
  /** Il valore mostrato: quello in attesa, o quello della macchina. */
  ora: ValoreImpostazione
  inAttesa: boolean
  /** Cambia a ogni tocco: riavvia la miccia. */
  giri: number
  scrivi: (v: ValoreImpostazione) => string
  onValore: (v: ValoreImpostazione) => void
  onConferma: () => void
  t: Translate
}) {
  const def = PARAMETRI[chiave]
  const radice = useRef<HTMLDivElement>(null)
  const pista = useRef<HTMLDivElement>(null)
  const [sinistra, setSinistra] = useState<number | null>(null)
  const attuale = stato.impostazioni[chiave]
  const { valori, indice } = valoriVicini(chiave, stato, ora)
  const elenco = typeof ora === 'string' || (def.max !== undefined && (def.max - (def.min ?? 0)) / (def.passo ?? 1) <= 6)
  const largo = elenco ? 58 : 15

  // Centrato sulla tessera toccata, senza uscire dallo schermo.
  useLayoutEffect(() => {
    const el = radice.current
    const cornice = el?.parentElement
    if (!el || !cornice) return
    const metti = () => {
      const tessera = cornice.querySelector(`[data-fam="manopola-${chiave}"]`)
      if (!tessera) return
      const c = cornice.getBoundingClientRect()
      const r = tessera.getBoundingClientRect()
      // Le maniglie dei cassetti, a sinistra, restano libere se c'è posto.
      const bordo = c.width > 640 ? 52 : 8
      setSinistra(Math.max(bordo, Math.min(c.width - el.offsetWidth - 8, r.left - c.left + r.width / 2 - el.offsetWidth / 2)))
    }
    metti()
    window.addEventListener('resize', metti)
    return () => window.removeEventListener('resize', metti)
  }, [chiave])

  const muovi = useRef({ ora, passo: (_: 1 | -1) => {} })
  muovi.current = {
    ora,
    passo: (verso) => {
      const v = passoDa(chiave, stato, ora, verso)
      if (v !== ora) onValore(v)
    },
  }

  // La rotellina va ascoltata a mano: quella di React è passiva e la pagina scorrerebbe.
  useEffect(() => {
    const el = radice.current
    if (!el) return
    let resto = 0
    const gira = (e: WheelEvent) => {
      e.preventDefault()
      resto += -e.deltaY || e.deltaX
      if (Math.abs(resto) < 30) return
      muovi.current.passo(resto > 0 ? 1 : -1)
      resto = 0
    }
    el.addEventListener('wheel', gira, { passive: false })
    return () => el.removeEventListener('wheel', gira)
  }, [])

  return (
    <div
      ref={radice}
      className={`simvent__nastro${inAttesa ? ' simvent__nastro--attesa' : ''}`}
      data-fam={`nastro-${chiave}`}
      style={sinistra === null ? { visibility: 'hidden' } : { left: sinistra }}
    >
      <div className="simvent__nastro-testo" aria-live="polite">
        <span>{t(def.etichetta)}</span>
        <span>
          {inAttesa ? `${scrivi(attuale)} → ` : ''}
          <b data-fam="nastro-valore" data-valore={ora}>{scrivi(ora)}</b> {t(def.unita)}
        </span>
        <i>{effetti(chiave, stato, ora)}</i>
      </div>
      <button type="button" aria-label="−" onClick={() => muovi.current.passo(-1)}>
        −
      </button>
      <div
        ref={pista}
        className="simvent__nastro-pista"
        onPointerDown={(e) => {
          const el = e.currentTarget
          const { valori: elencoValori, indice: partenza } = valoriVicini(chiave, stato, ora, 400)
          const x0 = e.clientX
          let ultimo = partenza
          el.setPointerCapture(e.pointerId)
          const segui = (m: PointerEvent) => {
            const i = Math.max(0, Math.min(elencoValori.length - 1, partenza - Math.round((m.clientX - x0) / largo)))
            if (i === ultimo) return
            ultimo = i
            onValore(elencoValori[i])
          }
          const fine = () => {
            el.removeEventListener('pointermove', segui)
            el.removeEventListener('pointerup', fine)
            el.removeEventListener('pointercancel', fine)
          }
          el.addEventListener('pointermove', segui)
          el.addEventListener('pointerup', fine)
          el.addEventListener('pointercancel', fine)
        }}
      >
        {valori.map((v, i) => {
          const passo = def.passo ?? 1
          const etichetta = elenco || (typeof v === 'number' && Math.round(v / passo) % 5 === 0)
          return (
            <span
              key={String(v)}
              className={`simvent__nastro-tacca${etichetta ? ' simvent__nastro-tacca--lunga' : ''}${v === attuale ? ' simvent__nastro-tacca--attuale' : ''}`}
              style={{ left: `calc(50% + ${(i - indice) * largo}px)` }}
            >
              {etichetta && <em>{scrivi(v)}</em>}
            </span>
          )
        })}
      </div>
      <button type="button" aria-label="+" onClick={() => muovi.current.passo(1)}>
        +
      </button>
      <button type="button" className="simvent__passi-conferma" onClick={onConferma} aria-label={t('vent.manopola.conferma')}>
        ✓
      </button>
      {inAttesa && <span key={giri} className="simvent__miccia" style={{ animationDuration: `${ATTESA_CONFERMA_MS}ms` }} />}
    </div>
  )
}

/** Che cosa vorrebbe dire confermare: solo dove il conto è esatto. */
function effetti(chiave: ChiaveImpostazione, stato: StatoVentilatore, ora: ValoreImpostazione): string {
  const i = { ...stato.impostazioni, [chiave]: ora }
  if (stato.modalita !== 'VC' && stato.modalita !== 'PRVC') return ''
  if (chiave === 'volume') return `${(Number(i.volume) / stato.paziente.pesoKg).toFixed(1)} ml/kg`
  return ''
}
