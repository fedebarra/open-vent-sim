/**
 * Il posizionamento del catetere dell'EAdi (OVS 3.8): la schermata del
 * discente.
 *
 * A sinistra le quattro derivazioni ECG del catetere, dalla più alta alla più
 * bassa, con sopra l'attività del diaframma; dove è più forte la traccia si
 * accende. Sotto, la corsia dell'EAdi. A destra il calcolatore della
 * profondità di partenza e i tasti per spingere o tirare il catetere, un passo
 * interelettrodico alla volta.
 *
 * Lo schermo non dice «giusto» o «sbagliato»: mostra le derivazioni, e
 * leggerle è il compito. In alto P grandi, in basso P che spariscono; il
 * diaframma nelle derivazioni di mezzo è il catetere a posto.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StatoVentilatore } from './fisica'
import type { Misure } from './parametri'
import type { AzioneVentilatore } from './azioni'
import type { Translate } from '../../../i18n'
import { Sweep, type SweepChannel } from '../monitor/Sweep'
import { attivitaDiaframma } from './pressioni'
import { puntoOnda } from './onde'
import {
  calibroPerPeso,
  catetereMontato,
  derivazioni,
  derivazioniForti,
  nexPerPeso,
  profonditaCalcolata,
  profonditaGiusta,
  type ViaCatetere,
} from './catetere'
import { creaEcgEsofageo, emg } from './ecgEsofageo'

const COLORE_ECG = '#e2e8f0'
const COLORE_DIAFRAMMA = '#d9f99d'
const COLORE_PAW = '#f5c542'
/** Sopra quanti µV oltre il minimo il diaframma «si vede» sulla derivazione. */
const SOGLIA_EVIDENZA = 1.5

export function PosizionamentoCatetere({
  stato,
  statoAl: statoAlDato,
  misure,
  clock,
  t,
  agisci,
}: {
  stato: StatoVentilatore
  /** Lo stato di un istante: fino all'atto dopo una regolazione, quello di prima (`seguiRegolazione` in `onde.ts`). */
  statoAl?: (t: number) => StatoVentilatore
  misure: Misure
  clock: () => number
  t: Translate
  agisci: (azione: AzioneVentilatore) => void
}) {
  const fis = stato.fisiologia
  const peso = stato.paziente.pesoKg
  const calibro = calibroPerPeso(peso)
  const nex = typeof fis.nexCm === 'number' && fis.nexCm > 0 ? fis.nexCm : nexPerPeso(peso)
  const [via, setVia] = useState<ViaCatetere>(fis.catetereVia ?? 'nasale')
  const calcolata = profonditaCalcolata(nex, via, calibro)
  const cm = typeof fis.catetereCm === 'number' ? fis.catetereCm : catetereMontato(fis.catetereEAdi ?? 'giusto', fis, peso).catetereCm
  const giusta = profonditaGiusta(fis, peso)
  const dv = useMemo(() => derivazioni(cm, giusta, calibro), [cm, giusta, calibro])
  const forti = useMemo(() => derivazioniForti(dv), [dv])
  const fc = stato.paziente.heartRate ?? 80

  const ecg = useRef(creaEcgEsofageo(dv, fc))
  useEffect(() => ecg.current.aggiorna(dv, fc), [dv, fc])

  const minimo = misure.eadiMin ?? 0
  const statoAl = statoAlDato ?? (() => stato)
  const fasica = (tt: number) => Math.max(0, (attivitaDiaframma(tt, statoAl(tt)) ?? 0) - minimo)

  const canali: SweepChannel[] = useMemo(() => {
    const derivazione = (k: number): SweepChannel => ({
      key: `der-${k}`,
      color: COLORE_ECG,
      at: (tt: number) => ecg.current.at(k, tt) + dv[k].diaframma * Math.min(2, fasica(tt) / 8) * 0.9 * emg(tt),
      range: (): [number, number] => [-2, 5],
      label: String(k + 1),
      weight: 1,
      evidenzia: forti.includes(k) ? (tt: number) => fasica(tt) > SOGLIA_EVIDENZA : undefined,
      coloreEvidenza: COLORE_DIAFRAMMA,
    })
    // La Paw accanto all'EAdi, quando la macchina ventila: è la verifica con
    // l'occlusione di fine espirazione.
    const paw: SweepChannel[] = stato.ventilando
      ? [{
          key: 'paw',
          color: COLORE_PAW,
          at: (tt: number) => puntoOnda(tt, statoAl(tt)).paw,
          range: (): [number, number] => [Math.min(-5, stato.impostazioni.peep - 15), Math.max(25, stato.impostazioni.peep + 20)],
          label: 'Paw',
          scale: t('vent.unit.cmH2O'),
          weight: 1.2,
        }]
      : []
    return [
      ...[0, 1, 2, 3].map(derivazione),
      ...paw,
      {
        key: 'eadi',
        color: COLORE_DIAFRAMMA,
        at: (tt: number) => attivitaDiaframma(tt, statoAl(tt)) ?? 0,
        range: (): [number, number] => [0, Math.max(12, (misure.eadiPicco ?? 10) * 1.2)],
        label: 'EAdi',
        scale: t('vent.unit.microV'),
        weight: 1.2,
      },
    ]
  }, [dv, forti, stato, statoAlDato, misure.eadiPicco, minimo, t])

  const passo = calibro.ied
  const sposta = (verso: 1 | -1) => agisci({ tipo: 'catetere', cm: Math.round((cm + verso * passo) * 10) / 10 })
  const fattore = via === 'nasale' ? '0,9' : '0,8'

  return (
    <div className="simvent__catetere" data-testid="vista-catetere-schermo">
      <div className="simvent__quadro simvent__catetere-tracce">
        <Sweep key="catetere" channels={canali} clock={clock} seconds={6} />
      </div>
      <div className="simvent__catetere-comandi">
        <section>
          <h3>{t('vent.catetere.calcolo')}</h3>
          <div className="simvent__catetere-riga">
            <span>{t('vent.catetere.nex')}</span>
            <b data-testid="cat-nex">{nex} cm</b>
          </div>
          <div className="simvent__catetere-scelta" role="group">
            {(['nasale', 'orale'] as ViaCatetere[]).map((v) => (
              <button key={v} type="button" data-testid={`cat-via-${v}`} className={via === v ? 'scelto' : ''} onClick={() => setVia(v)}>
                {t(v === 'nasale' ? 'vent.catetere.nasale' : 'vent.catetere.orale')}
              </button>
            ))}
          </div>
          <div className="simvent__catetere-riga">
            <span>{calibro.nome}</span>
            <small>
              {nex} × {fattore} + {calibro.costante}
            </small>
          </div>
          <div className="simvent__catetere-riga">
            <span>{t('vent.catetere.calcolata')}</span>
            <b data-testid="cat-calcolata">{calcolata.toFixed(1)} cm</b>
          </div>
          <button type="button" className="simvent__catetere-azione" data-testid="cat-inserisci" onClick={() => agisci({ tipo: 'catetere', cm: calcolata, via })}>
            {t('vent.catetere.inserisci')} {calcolata.toFixed(1)} cm
          </button>
        </section>
        <section>
          <h3>{t('vent.catetere.profondita')}</h3>
          <b className="simvent__catetere-cm" data-testid="cat-cm">{cm.toFixed(1)} cm</b>
          <div className="simvent__catetere-scelta" role="group">
            <button type="button" data-testid="cat-tira" onClick={() => sposta(-1)}>
              ↑ {t('vent.catetere.tira')}
            </button>
            <button type="button" data-testid="cat-spingi" onClick={() => sposta(1)}>
              ↓ {t('vent.catetere.spingi')}
            </button>
          </div>
          <small>{t('vent.catetere.passo')} {(passo * 10).toFixed(0)} mm</small>
        </section>
        <section>
          <h3>{t('vent.catetere.verifica')}</h3>
          <button
            type="button"
            data-testid="cat-occlusione"
            className={stato.manovra === 'pausa-espiratoria' ? 'simvent__catetere-azione scelto' : 'simvent__catetere-azione'}
            disabled={!stato.ventilando || (stato.manovra !== null && stato.manovra !== 'pausa-espiratoria')}
            onClick={() => agisci({ tipo: 'manovra', manovra: stato.manovra === 'pausa-espiratoria' ? null : 'pausa-espiratoria' })}
          >
            {t('vent.manovra.espiratoria')}
          </button>
          <small>{t(stato.ventilando ? 'vent.catetere.verificaAiuto' : 'vent.catetere.verificaFerma')}</small>
        </section>
        <p className="simvent__catetere-aiuto">{t('vent.catetere.aiuto')}</p>
      </div>
    </div>
  )
}
