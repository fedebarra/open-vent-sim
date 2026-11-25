/**
 * I limiti d'allarme: una riga per misura, quattro linguette da trascinare.
 *
 * Le rosse stanno sopra la barra e le gialle sotto, così due soglie allo stesso
 * valore non si coprono. Mentre si trascina il valore vive qui; parte **una**
 * azione sola quando il dito si alza, e nel registro resta una riga sola.
 */

import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../components/Icon'
import type { TranslationKey } from '../../../i18n/it'
import type { Translate } from '../../../i18n'
import type { AzioneVentilatore } from './azioni'
import type { StatoVentilatore } from './fisica'
import type { Volumi } from './suono'
import type { ContestoVista, Misure } from './parametri'
import {
  ALLARMI,
  completo,
  gravitaDi,
  portaLimite,
  valoreDa,
  type AllarmeAttivo,
  type ChiaveAllarme,
  type EstremoLimite,
  type LimiteAllarme,
  type LimitiAllarme,
} from './allarmi'

/** Da dove a dove è andata ogni misura negli ultimi due minuti. */
export type Escursioni = Partial<Record<ChiaveAllarme, [number, number]>>

const ESTREMI: EstremoLimite[] = ['basso', 'preBasso', 'preAlto', 'alto']
const NOME_SOGLIA: Record<EstremoLimite, TranslationKey> = {
  basso: 'vent.soglia.basso',
  preBasso: 'vent.soglia.preBasso',
  preAlto: 'vent.soglia.preAlto',
  alto: 'vent.soglia.alto',
}
/** Quanto si aspetta che la regia confermi prima di credere all'istantanea. */
const ATTESA_MS = 2000

interface Bozza {
  chiave: ChiaveAllarme
  limite: LimiteAllarme
}

export function RigheAllarmi({
  stato,
  misure,
  limiti,
  attivi,
  escursioni,
  operabile,
  volumi,
  onVolumi,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  misure: Misure
  limiti: LimitiAllarme
  attivi: AllarmeAttivo[]
  escursioni: Escursioni
  operabile: boolean
  /** I volumi di questo schermo; nullo dove il suono non c'è (lo specchio). */
  volumi: Volumi | null
  onVolumi: (v: Volumi) => void
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  const ctx: ContestoVista = {
    ambiente: stato.ambiente,
    modalita: stato.modalita,
    respiro: stato.respiro,
    impostazioni: stato.impostazioni,
  }
  const chiavi = (Object.keys(ALLARMI) as ChiaveAllarme[]).filter((k) => ALLARMI[k].visibile(ctx))
  const suona = new Map(attivi.map((a) => [a.chiave, a]))
  const [scelta, setScelta] = useState<{ chiave: ChiaveAllarme; estremo: EstremoLimite } | null>(null)
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const trascina = useRef(false)

  // Lasciata la linguetta, la bozza copre l'attesa della regia: poi comanda l'istantanea.
  useEffect(() => {
    if (!bozza || trascina.current) return
    const arrivato = JSON.stringify(completo(bozza.chiave, limiti[bozza.chiave])) === JSON.stringify(completo(bozza.chiave, bozza.limite))
    if (arrivato) {
      setBozza(null)
      return
    }
    const id = window.setTimeout(() => setBozza(null), ATTESA_MS)
    return () => window.clearTimeout(id)
  }, [bozza, limiti])

  const limiteDi = (k: ChiaveAllarme) => completo(k, bozza?.chiave === k ? bozza.limite : limiti[k])

  const manda = (k: ChiaveAllarme, estremo: EstremoLimite, valore: number) => {
    const limite = portaLimite(k, limiti[k], estremo, valore)
    const arrivo = completo(k, limite)[estremo]
    if (arrivo === null || arrivo === completo(k, limiti[k])[estremo]) {
      setBozza(null)
      return
    }
    setBozza({ chiave: k, limite })
    agisci({ tipo: 'limite-valore', chiave: k, estremo, valore: arrivo })
  }

  const passo = (verso: 1 | -1) => {
    if (!scelta) return
    const attuale = limiteDi(scelta.chiave)[scelta.estremo]
    if (attuale === null) return
    // Parte dalla bozza: due tocchi svelti sono due passi anche se la regia non ha ancora risposto.
    const limite = portaLimite(scelta.chiave, limiteDi(scelta.chiave), scelta.estremo, attuale + verso * ALLARMI[scelta.chiave].passo)
    const arrivo = completo(scelta.chiave, limite)[scelta.estremo]
    if (arrivo === null || arrivo === attuale) return
    setBozza({ chiave: scelta.chiave, limite })
    agisci({ tipo: 'limite-valore', chiave: scelta.chiave, estremo: scelta.estremo, valore: arrivo })
  }

  const sceltaViva = scelta && chiavi.includes(scelta.chiave) ? scelta : null

  return (
    <div className="simvent__righe">
      <div className="simvent__righe-testa">
        <button type="button" data-fam="limite-meno" disabled={!operabile || !sceltaViva} onClick={() => passo(-1)} aria-label="−">
          −
        </button>
        <span data-fam="limite-scelto">
          {sceltaViva ? (
            <>
              {t(ALLARMI[sceltaViva.chiave].etichetta)} · {t(NOME_SOGLIA[sceltaViva.estremo])}{' '}
              <b>{limiteDi(sceltaViva.chiave)[sceltaViva.estremo]}</b>
            </>
          ) : (
            t('vent.soglia.scegli')
          )}
        </span>
        <button type="button" data-fam="limite-piu" disabled={!operabile || !sceltaViva} onClick={() => passo(1)} aria-label="+">
          +
        </button>
        <button
          type="button"
          className="simvent__ripristina-tutti"
          data-fam="limiti-ripristina"
          disabled={!operabile}
          onClick={() => {
            setBozza(null)
            agisci({ tipo: 'limiti-iniziali' })
          }}
        >
          <Icon name="reset" size={16} /> {t('vent.soglia.ripristinaTutti')}
        </button>
      </div>
      {chiavi.map((k) => {
        const def = ALLARMI[k]
        const l = limiteDi(k)
        const attivo = suona.get(k)
        const gravita = attivo ? gravitaDi(attivo) : null
        const classe = `simvent__riga-allarme${gravita ? ` simvent__riga-allarme--${gravita}` : ''}${l.acceso ? '' : ' simvent__riga-allarme--spento'}`
        if (def.interruttore) {
          return (
            <div key={k} className={classe} data-fam={`limite-${k}`}>
              <span className="simvent__etichetta">{t(def.etichetta)}</span>
              <button
                type="button"
                className={`simvent__interruttore${l.acceso ? ' acceso' : ''}`}
                disabled={!operabile}
                onClick={() => agisci({ tipo: 'allarme', chiave: k, acceso: !l.acceso })}
                aria-label={t(def.etichetta)}
                aria-pressed={l.acceso}
              >
                <span />
              </button>
            </div>
          )
        }
        const pct = (v: number) =>
          `${(Math.min(1, Math.max(0, (v - def.minimo) / (def.massimo - def.minimo))) * 100).toFixed(2)}%`
        const valore = valoreDa(k, stato, misure) ?? attivo?.valore ?? null
        const giro = escursioni[k]
        const da = [def.minimo, l.basso ?? def.minimo, l.preBasso ?? l.basso ?? def.minimo]
        const a = [l.preAlto ?? l.alto ?? def.massimo, l.alto ?? def.massimo, def.massimo]
        const fasce: [string, number, number][] = [
          ['rosso', da[0], da[1]],
          ['giallo', da[1], da[2]],
          ['buono', da[2], a[0]],
          ['giallo', a[0], a[1]],
          ['rosso', a[1], a[2]],
        ]
        return (
          <div key={k} className={classe} data-fam={`limite-${k}`}>
            <span className="simvent__riga-nome">
              <span className="simvent__etichetta">
                {t(def.etichetta)} <em>{t(def.unita)}</em>
              </span>
              <b>
                {gravita ? (gravita === 'rosso' ? '!! ' : '! ') : ''}
                {valore === null ? '––' : parseFloat(valore.toFixed(def.passo < 1 ? 1 : 0))}
              </b>
            </span>
            <div className="simvent__pista" data-pista={k}>
              {fasce.map(([c, x, y], i) =>
                y > x ? <i key={i} className={`simvent__fascia simvent__fascia--${c}`} style={{ left: pct(x), width: `calc(${pct(y)} - ${pct(x)})` }} /> : null,
              )}
              {giro && <i className="simvent__escursione" style={{ left: pct(giro[0]), width: `calc(${pct(giro[1])} - ${pct(giro[0])})` }} />}
              {valore !== null && <i className="simvent__adesso" style={{ left: pct(valore) }} />}
              {ESTREMI.map((e) => {
                const v = l[e]
                if (v === null) return null
                const colore = e === 'basso' || e === 'alto' ? 'rosso' : 'giallo'
                const viva = sceltaViva?.chiave === k && sceltaViva.estremo === e
                return (
                  <button
                    key={e}
                    type="button"
                    role="slider"
                    aria-label={`${t(def.etichetta)} ${t(NOME_SOGLIA[e])}`}
                    aria-valuenow={v}
                    aria-valuemin={def.minimo}
                    aria-valuemax={def.massimo}
                    data-fam={`soglia-${k}-${e}`}
                    disabled={!operabile}
                    className={`simvent__linguetta simvent__linguetta--${colore}${viva ? ' simvent__linguetta--scelta' : ''}`}
                    style={{ left: pct(v) }}
                    onPointerDown={(ev) => {
                      const el = ev.currentTarget
                      const pista = el.parentElement!.getBoundingClientRect()
                      // Il dito non parte mai dal centro esatto: lo scarto resta, o la soglia salta.
                      const centro = pista.left + ((v - def.minimo) / (def.massimo - def.minimo)) * pista.width
                      const scarto = ev.clientX - centro
                      const partenza = ev.clientX
                      let ultimo = v
                      let mosso = false
                      setScelta({ chiave: k, estremo: e })
                      el.setPointerCapture(ev.pointerId)
                      trascina.current = true
                      const muove = (m: PointerEvent) => {
                        if (!mosso && Math.abs(m.clientX - partenza) < 4) return
                        mosso = true
                        ultimo = def.minimo + ((m.clientX - scarto - pista.left) / pista.width) * (def.massimo - def.minimo)
                        setBozza({ chiave: k, limite: portaLimite(k, limiti[k], e, ultimo) })
                      }
                      const fine = (m: PointerEvent) => {
                        el.removeEventListener('pointermove', muove)
                        el.removeEventListener('pointerup', fine)
                        el.removeEventListener('pointercancel', fine)
                        trascina.current = false
                        if (m.type === 'pointerup' && mosso) manda(k, e, ultimo)
                        else setBozza(null)
                      }
                      el.addEventListener('pointermove', muove)
                      el.addEventListener('pointerup', fine)
                      el.addEventListener('pointercancel', fine)
                    }}
                    onFocus={() => setScelta({ chiave: k, estremo: e })}
                    onKeyDown={(ev) => {
                      const verso = /Up|Right/.test(ev.key) ? 1 : /Down|Left/.test(ev.key) ? -1 : 0
                      if (!verso) return
                      ev.preventDefault()
                      passo(verso as 1 | -1)
                    }}
                  >
                    <span>{v}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="simvent__ripristina"
              data-fam={`ripristina-${k}`}
              disabled={!operabile}
              title={t('vent.soglia.ripristina')}
              aria-label={`${t('vent.soglia.ripristina')}: ${t(def.etichetta)}`}
              onClick={() => {
                setBozza(null)
                agisci({ tipo: 'limite-iniziale', chiave: k })
              }}
            >
              <Icon name="reset" size={18} />
            </button>
          </div>
        )
      })}
      {volumi && (
        <div className="simvent__volumi">
          {(['respiro', 'allarmi'] as const).map((v) => (
            <label key={v}>
              <span className="simvent__etichetta">{t(v === 'respiro' ? 'vent.volume.respiro' : 'vent.volume.allarmi')}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volumi[v] * 100)}
                data-fam={`volume-${v}`}
                onChange={(e) => onVolumi({ ...volumi, [v]: Number(e.target.value) / 100 })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
