/**
 * L'apparecchio: un solo telaio per quattro macchine diverse.
 *
 * ## Un layout, quattro ambienti
 *
 * Anestesia, intensiva invasiva, non invasiva e alto flusso non sono quattro
 * schermate: sono **quattro insiemi di parametri** dentro lo stesso telaio.
 * Testata, curve, colonna di monitoraggio, maniglie, barra dei parametri
 * stanno sempre dove stanno; quello che cambia è che cosa ci compare dentro, e
 * lo decide `visibile()` in `parametri.ts`, non un `if` in questo file.
 *
 * La ragione è la decisione «un solo layout», presa aprendo il ventilatore
 * (HANDOVER §148-§151): chi in aula passa dall'anestesia alla terapia intensiva non deve
 * reimparare dove sono le cose. E dal lato di chi scrive il codice, quattro
 * markup diversi vogliono dire che una correzione si fa quattro volte e la
 * quarta si dimentica.
 *
 * ## Non applica niente
 *
 * Ogni tocco esce da qui come `AzioneVentilatore` e basta (`azioni.ts`): non si
 * muove un parametro, non si silenzia un allarme, non si accende una macchina.
 * La regia è l'unico produttore dell'istantanea, e un device che si aggiustasse
 * da solo mostrerebbe qualcosa di diverso da quello che vede chi conduce. È la
 * stessa regola del monitor, applicata a una superficie che di comandi ne ha
 * molti di più.
 *
 * ## Il pennello è quello del monitor
 *
 * Le curve si disegnano con `<Sweep>` — lo stesso componente delle tracce del
 * monitor, con la stessa cancellazione davanti alla punta. Riscriverne un
 * secondo per avere le corsie dentro delle schede sarebbe stato un secondo
 * posto dove sbagliare il campionamento; le schede sono CSS.
 *
 * ## Niente diagnosi, e niente spiegazioni
 *
 * Il device mostra impostazioni e misure. Non scrive mai che asincronia sta
 * facendo il paziente — riconoscerla è il compito dei discenti — e attorno ai
 * consumabili non scrive niente del tutto: la cartuccia quasi vuota si vede che
 * è quasi vuota (`Consumabili.tsx`). Riempire a gas aperti riesce senza un
 * avviso: quella riga la scrive il registro.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { oraDellAula } from '../monitor/orologio'
import { Sweep, type SweepChannel } from '../monitor/Sweep'
import { createCapnoWaveform, VITALS_VUOTI } from '../monitor/sources'
import { createMonitorSound } from '../monitor/sound'
import { Icon } from '../../../components/Icon'
import { useT, type Translate } from '../../../i18n'
import { Cartuccia, Canister, CameraAcqua } from './Consumabili'
import type { AzioneVentilatore } from './azioni'
import {
  NOME_CASSETTO,
  VELOCITA_PREDEFINITA,
  VELOCITA_SCHERMO,
  assestaScala,
  giraParametro,
  gruppiMonitoraggio,
  impostazioniDaMostrare,
  maniglie,
  scaleOnde,
  tempoDalTocco,
  type Cassetto,
} from './pannello'
import {
  NOME_AMBIENTE,
  NOME_ESITO,
  NOME_DISINFEZIONE,
  NOME_INTERFACCIA,
  NOME_MANOVRA,
  NOME_MODALITA,
  NOME_RESPIRO,
} from './nomi'
import {
  ALLARMI,
  silenzioRimasto,
  type AllarmeAttivo,
  type ChiaveAllarme,
  type LimitiAllarme,
} from './allarmi'
import {
  AGENTI,
  MASSIMO_AGENTI,
  ORDINE_AGENTI,
  RIEMPIMENTO_SECONDI,
  type Agente,
  type Consumabile,
} from './gas'
import { creaOnde, nelTrigger, puntoOnda } from './onde'
import { RECLUTAMENTO_SECONDI, type Manovra, type StatoVentilatore } from './fisica'
import { CIRCUITI_PER_AMBIENTE, MANOVRA_SECONDI, type VentIstantanea } from './istantanea'
import type { TranslationKey } from '../../../i18n/it'
import type { Circuito } from '../../paziente/presidiFigura'
import {
  MODALITA_PER_AMBIENTE,
  PARAMETRI,
  limitiAltoFlusso,
  scriviValore,
  type ChiaveImpostazione,
  type ChiaveMisura,
  type ContestoVista,
  type Misure,
  type Modalita,
} from './parametri'

/** I colori delle tre curve: sono quelli convenzionali, non una scelta. */
const COLORI = { paw: '#ffb300', flusso: '#4caf50', volume: '#00b0ff', co2: '#e5e7eb' }

/** Il padding orizzontale della corsia più il bordo, in pixel: serve al cursore. */
const CORNICE_CORSIA = 15

export interface VentilatoreProps {
  /** Gli atti dati col pallone; null quando il respiro non passa dalle mani di nessuno. */
  attiManuali?: number | null
  stato: StatoVentilatore
  misure: Misure
  allarmi: AllarmeAttivo[]
  limiti: LimitiAllarme
  /** Fino a quando gli allarmi tacciono, nel tempo del ventilatore. */
  silenziatoFinoA: number
  /**
   * La voce degli schermi, decisa dalla regia e globale sulla sessione.
   *
   * Spenta, questo apparecchio tace del tutto — allarmi compresi — qualunque
   * cosa dica il permesso del browser. Vera per default: le istantanee di
   * prima non portano il campo.
   */
  suoniAttivi?: boolean
  /** Se una regia sta ascoltando: senza, i comandi restano in attesa. */
  regiaViva?: boolean
  /**
   * Il pieno schermo della pagina, e il suo tasto in testata.
   *
   * Come sul monitor: al primo tocco ci si va da sé, ma una cosa che succede
   * da sola deve avere anche un modo di farla — chi esce col gesto di sistema
   * resta con le barre del browser attorno a un apparecchio da sala operatoria.
   * Assente (l'anteprima, un riquadro di parete): il tasto non c'è.
   */
  pienoSchermo?: boolean
  onPienoSchermo?: () => void
  /** Il tempo del ventilatore in secondi: uno solo per tutte le curve. */
  clock: () => number
  /** Quando la manovra in corso è cominciata, o nulla. Vedi `VentIstantanea`. */
  manovraDa: number | null
  /** Quando è cominciato il cambio di un consumabile, o niente. */
  riempimentoDa?: number | null
  /** Che cosa si sta cambiando, finché dura. */
  riempimentoCosa?: Consumabile | null
  /** L'ultima misura di manovra completata, condivisa fra gli schermi. */
  manovraEsito: VentIstantanea['manovraEsito']
  /** Quando è stato fatto l'ultimo autotest, in millisecondi epoch, o nulla. */
  autotestMs: number | null
  /**
   * Falso: schermo in sola visione.
   *
   * Non è un permesso amministrativo: è la differenza fra il tablet in mano al
   * discente e lo specchio appeso in fondo alla sala, che deve mostrare la
   * stessa macchina senza che passandoci davanti qualcuno la cambi.
   */
  operabile: boolean
  onAzione: (azione: AzioneVentilatore) => void
  /** L'uscita in testa. Chi non ha telaio attorno se la porta (§standalone). */
  onEsci?: () => void
  /** Classi in più sulla radice: oggi la riserva d'angolo per la X di Safari. */
  riserva?: string
}

export function Ventilatore({
  stato,
  attiManuali = null,
  misure,
  allarmi,
  limiti,
  silenziatoFinoA,
  suoniAttivi = true,
  regiaViva = true,
  pienoSchermo = false,
  onPienoSchermo,
  clock,
  manovraDa,
  riempimentoDa = null,
  riempimentoCosa = null,
  manovraEsito,
  autotestMs,
  operabile,
  onAzione,
  onEsci,
  riserva = '',
}: VentilatoreProps) {
  const t = useT()
  const [cassetto, setCassetto] = useState<Cassetto | null>(null)
  /**
   * Il cassetto che sta **uscendo di scena**: chiuderlo non lo smonta subito.
   *
   * Un cassetto è un oggetto fisico e si deve vedere scorrere: dentro dal
   * fianco sinistro all'apertura, fuori dallo stesso fianco alla chiusura. Lo
   * scivolo d'ingresso lo fa il CSS sul montaggio; quello d'uscita ha bisogno
   * che il pannello resti montato per la durata dell'animazione, ed è quello
   * che questo stato tiene: il contenuto da mostrare mentre scivola via.
   */
  const [cassettoVia, setCassettoVia] = useState<Cassetto | null>(null)
  const chiudiCassetto = () => {
    setCassetto((aperto) => {
      if (aperto) setCassettoVia(aperto)
      return null
    })
  }
  const [scelta, setScelta] = useState<ChiaveImpostazione | null>(null)
  /**
   * Quante volte si è girato il valore della tessera aperta.
   *
   * Serve solo a **riarmare il timer** di chiusura: la tessera con i tasti
   * fuori si richiude da sola dopo qualche secondo di inattività — come la
   * manopola di un apparecchio vero, che esce dalla modalità di regolazione —
   * e ogni tocco su più o meno riparte il conto.
   */
  const [giri, setGiri] = useState(0)
  useEffect(() => {
    if (scelta === null) return
    const id = window.setTimeout(() => setScelta(null), 6000)
    return () => window.clearTimeout(id)
  }, [scelta, giri])

  // ## Il quadro delle curve è **dell'apparecchio**, non del paziente
  //
  // Velocità dello schermo, congelamento e cursore sono regolazioni di questo
  // schermo: due apparecchi sullo stesso letto possono averle diverse e avere
  // tutti e due ragione. È la distinzione di `monitor/apparecchio.ts`, e per
  // questo vivono qui e non nell'istantanea.
  const [velocita, setVelocita] = useState(VELOCITA_PREDEFINITA)
  const [congelato, setCongelato] = useState<number | null>(null)
  const [cursore, setCursore] = useState<number | null>(null)

  // L'orologio per il pennello deve essere **stabile**: una funzione nuova ad
  // ogni istantanea farebbe ripartire l'effetto del disegno ogni due secondi.
  // Congelato vuol dire fermo: il pennello resta dov'è, senza casi in più.
  const clockRef = useRef(clock)
  clockRef.current = clock
  const congelatoRef = useRef(congelato)
  congelatoRef.current = congelato
  const clockQuadro = useCallback(() => congelatoRef.current ?? clockRef.current(), [])

  const congela = () => {
    accendiSuono()
    if (congelato === null) {
      setCongelato(clock())
    } else {
      setCongelato(null)
      setCursore(null)
    }
  }

  /**
   * Il tocco sullo schermo fermo: il cursore va lì.
   *
   * La cornice della corsia è larga 15 px per lato (padding più bordo): il
   * conto della frazione li toglie, così il cursore cade esattamente sul punto
   * della curva che sta sotto il dito e non un dito più in là.
   */
  const toccaQuadro = (e: { currentTarget: HTMLDivElement; clientX: number; clientY: number }) => {
    if (congelato === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - rect.left - CORNICE_CORSIA) / (rect.width - CORNICE_CORSIA * 2)
    if (f < 0 || f > 1) return
    setCursore(tempoDalTocco(f, congelato, velocita))
  }

  const ctx: ContestoVista = {
    ambiente: stato.ambiente,
    modalita: stato.modalita,
    respiro: stato.respiro,
    impostazioni: stato.impostazioni,
  }
  const inManuale = stato.ambiente === 'anestesia' && stato.respiro === 'manuale'
  const inAltoFlusso = stato.ambiente === 'alto-flusso'

  // ## Il suono è quello del monitor
  //
  // Stesso modulo, stessa voce: due apparecchi nella stessa stanza che
  // allarmano con due timbri diversi si leggono come due guasti diversi. Si
  // accende **al primo tocco**, perché l'attivazione utente si consuma e un
  // browser non fa suonare niente prima.
  const suono = useMemo(() => createMonitorSound(), [])
  useEffect(() => () => suono.dispose(), [suono])

  // ## Il conto alla rovescia del silenzio deve **scorrere**
  //
  // «Zitto fino al secondo tale» è un numero nello stato, e senza qualcosa che
  // batta il tempo resterebbe scritto quello di quando è stato premuto il
  // tasto. Un secondo per volta, e solo finché c'è un silenzio in corso: un
  // ticchettio che gira sempre farebbe ridisegnare la testata per niente per
  // tutta la sessione.
  const [, batti] = useState(0)
  const zittito = clock() < silenziatoFinoA
  useEffect(() => {
    if (!zittito) return
    const id = window.setInterval(() => batti((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [zittito])

  useEffect(() => {
    // La voce del ventilatore, non quella del monitor: in stanza sono due
    // macchine, e quando suona questa il team deve girarsi verso il tubo.
    // E la voce la decide la regia, per tutta la sessione: spenta, niente
    // allarme qui — qualunque cosa dica il permesso del browser.
    suono.setAlarm(suoniAttivi && allarmi.length > 0 && !zittito ? 'ventilatore' : null)
  }, [suono, allarmi.length, zittito, suoniAttivi])

  // La regia ha tolto la voce: si tace subito, non al prossimo allarme.
  useEffect(() => {
    if (!suoniAttivi) suono.disable()
  }, [suoniAttivi, suono])

  const accendiSuono = () => {
    // Il permesso del browser si prende comunque al primo tocco — così quando
    // la regia riaccende la voce c'è subito — ma da spento si resta muti.
    if (!suono.enabled()) {
      void suono.enable().then(() => {
        if (!suoniAttiviRef.current) suono.disable()
      })
    }
  }
  const suoniAttiviRef = useRef(suoniAttivi)
  suoniAttiviRef.current = suoniAttivi
  const agisci = (azione: AzioneVentilatore) => {
    accendiSuono()
    if (operabile) onAzione(azione)
  }

  // Le curve si rifanno solo quando cambia qualcosa che le riguarda: `creaOnde`
  // chiude sopra lo stato, e ricrearla ad ogni render azzererebbe la memoria di
  // un istante che le tiene allineate fra loro.
  const onde = useMemo(() => creaOnde(stato), [stato])
  // La sorgente resta la stessa e legge da un riferimento: rifarla a ogni misura
  // dimenticherebbe l'atto a mano in corso e troncherebbe la gobba a metà.
  const misureOra = useRef(misure)
  misureOra.current = misure
  const attiOra = useRef(attiManuali)
  attiOra.current = attiManuali
  const capno = useMemo(
    () =>
      createCapnoWaveform(
        () => ({
          ...VITALS_VUOTI,
          etco2: misureOra.current.etco2,
          respiratoryRate: misureOra.current.spontaneousRate ?? misureOra.current.measuredFrequency,
        }),
        () => attiOra.current,
      ),
    [],
  )
  // La Paw del pallone: la gobba di ogni atto dato a mano, sopra il livello dell'APL.
  const attoPaw = useRef<{ visti: number | null; a: number | null }>({ visti: null, a: null })
  const pawAMano = useCallback(
    (t: number) => {
      const n = attiOra.current
      const m = attoPaw.current
      if (n === null) {
        m.visti = null
        m.a = null
        return onde.paw(t)
      }
      if (m.visti !== null && n > m.visti) m.a = t
      m.visti = n
      const dopo = m.a === null ? -1 : t - m.a
      return onde.paw(t) + (dopo >= 0 && dopo < 1.1 ? 16 * Math.sin((Math.PI * dopo) / 1.1) : 0)
    },
    [onde],
  )

  // Memorizzata: un oggetto nuovo ad ogni render rifarebbe le corsie ad ogni
  // render, e con loro tutto quello che ci sta attaccato.
  //
  // ## E **assestata**, o la manopola sembra non fare niente
  //
  // `scaleOnde` dice quale fondo scala vorrebbe adesso; qui si decide se
  // adottarlo. Su un ventilatore vero la scala sta ferma finché la curva ci sta
  // dentro: alzare la pressione di supporto deve far crescere **la curva**, non
  // la corsia insieme a lei — se salgono tutt'e due il disegno resta identico e
  // in aula si legge «se alzo la PS non cambia niente», che è esattamente il
  // rilievo da cui viene questo blocco. Si cresce quando servirebbe uscire, si
  // scende solo quando è rimpicciolita parecchio.
  const scalaTenuta = useRef<ReturnType<typeof scaleOnde> | null>(null)
  const voluta = useMemo(() => scaleOnde(stato, misure), [stato, misure])
  const scale = useMemo(() => {
    const prima = scalaTenuta.current
    const assesta = (
      a: [number, number],
      b: [number, number] | undefined,
    ): [number, number] => [
      -assestaScala(-(b?.[0] ?? a[0]), -a[0]),
      assestaScala(b?.[1] ?? a[1], a[1]),
    ]
    const prossima = {
      paw: assesta(voluta.paw, prima?.paw),
      flusso: assesta(voluta.flusso, prima?.flusso),
      volume: assesta(voluta.volume, prima?.volume),
    }
    scalaTenuta.current = prossima
    return prossima
  }, [voluta])

  // Sotto il cursore i numeri accanto alle curve diventano **quelli di quel
  // punto**: pressione, flusso e volume all'istante toccato. È il motivo per
  // cui si congela: leggere un valore preciso su una curva che scorre non si
  // può, e su una macchina vera si fa esattamente così.
  const alCursore = useMemo(
    () => (cursore !== null && congelato !== null ? puntoOnda(cursore, stato) : null),
    [cursore, congelato, stato],
  )

  const corsie: SweepChannel[] = useMemo(() => {
    if (inAltoFlusso) return []
    if (inManuale) {
      // A pallone le curve sono due: la pressione delle vie aeree, che segue
      // gli atti del paziente e si appiattisce sull'APL quando si addormenta, e
      // il capnogramma — che in manuale è **la** curva, perché è l'unica che
      // dice se quello che si sta facendo arriva ai polmoni.
      return [
        {
          key: 'paw',
          color: COLORI.paw,
          at: pawAMano,
          range: () => scale.paw,
          label: 'Paw',
          scale: t('vent.unit.cmH2O'),
          value: alCursore ? alCursore.paw.toFixed(1) : scriviValore('pPeak', misure.pPeak),
        },
        {
          key: 'co2',
          color: COLORI.co2,
          at: capno.at,
          range: () => [0, 60],
          label: 'CO₂',
          scale: t('vent.unit.mmHg'),
          value: scriviValore('etco2', misure.etco2),
        },
      ]
    }
    return [
      {
        key: 'paw',
        color: COLORI.paw,
        at: onde.paw,
        range: () => scale.paw,
        label: 'Paw',
        scale: t('vent.unit.cmH2O'),
        value: alCursore ? alCursore.paw.toFixed(1) : scriviValore('pPeak', misure.pPeak),
      },
      {
        key: 'flusso',
        color: COLORI.flusso,
        at: onde.flusso,
        range: () => scale.flusso,
        label: t('vent.wave.flusso'),
        scale: t('vent.unit.lMin'),
        // **Il trigger si vede, e si vede bianco.** Nei cento millisecondi in
        // cui il paziente tira, il flusso va negativo prima che la macchina
        // dia qualcosa: è l'unico punto della curva in cui si legge quanto è
        // sensibile la regolazione, ed è quello che si guarda dopo averla
        // toccata. In volume e pressione controllata non c'è niente da
        // marcare — l'atto lo decide l'orologio — e `nelTrigger` torna falso.
        evidenzia: (istante: number) => nelTrigger(istante, stato),
        value: alCursore ? alCursore.flusso.toFixed(1) : scriviValore('volumeMinute', misure.volumeMinute),
      },
      {
        key: 'volume',
        color: COLORI.volume,
        at: onde.volume,
        range: () => scale.volume,
        label: t('vent.wave.volume'),
        scale: t('vent.unit.ml'),
        value: alCursore ? alCursore.volume.toFixed(0) : scriviValore('volumeExpired', misure.volumeExpired),
      },
    ]
  }, [onde, pawAMano, capno, inManuale, inAltoFlusso, misure, scale, alCursore, t])

  const impostazioni = impostazioniDaMostrare(stato)
  const gruppi = gruppiMonitoraggio(ctx, stato.gas?.agenti.length ?? 0)

  const agente = stato.gas?.agenti[0] ?? null

  return (
    <div
      className={`simvent simvent--${stato.ambiente} ${riserva}`.trim()}
      onPointerDown={(e) => {
        accendiSuono()
        // Toccare fuori dalla tessera aperta la chiude: è il gesto naturale
        // per dire «ho finito», e senza questo la tessera restava allargata
        // finché non la si ritoccava — che in aula si legge come un guasto.
        if (scelta !== null && !(e.target as HTMLElement).closest('.simvent__manopola')) {
          setScelta(null)
        }
      }}
      data-operabile={operabile ? 'si' : 'no'}
    >
      <header className="simvent__testata">
        {onEsci && (
          <button type="button" className="simvent__tondo" onClick={onEsci} aria-label={t('action.back')} data-tour="esci">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="14 6 8 12 14 18" />
            </svg>
          </button>
        )}
        <span className="simvent__titolo">{t(NOME_AMBIENTE[stato.ambiente])}</span>
        {/* La regia non sta ascoltando: i comandi restano in attesa, e va
            detto dove il dito preme — «avvia» che non fa niente in silenzio è
            il guasto che nessuno diagnostica (memoria: azione senza chi la
            raccoglie). */}
        {operabile && !regiaViva && (
          <span className="simvent__regia-assente">{t('aula.regia.assente')}</span>
        )}
        <span className="simvent__vuoto" />
        <span className={`simvent__pillola simvent__pillola--${stato.ventilando ? 'attiva' : 'ferma'}`}>
          <i />
          {stato.ventilando
            ? inManuale
              ? t('vent.state.manuale')
              : t('vent.state.attiva')
            : t('vent.state.standby')}
        </span>
        {agente && (
          <span className="simvent__pillola simvent__pillola--agente">
            <i style={{ background: AGENTI[agente].colore, boxShadow: `0 0 9px ${AGENTI[agente].colore}` }} />
            {t(AGENTI[agente].etichetta)} · MAC {scriviValore('mac', misure.mac)}
          </span>
        )}
        <span className="simvent__vuoto" />
        {allarmi.length > 0 && (
          <span className={`simvent__allarme${zittito ? ' simvent__allarme--zitto' : ''}`}>
            {allarmi.map((a) => t(ALLARMI[a.chiave].etichetta)).join(' · ')}
            {zittito && <em>{silenzioRimasto(silenziatoFinoA, clock())}s</em>}
          </span>
        )}
        {onPienoSchermo && (
          <button
            type="button"
            className="simvent__tondo"
            onClick={onPienoSchermo}
            aria-label={t('mon.fullscreen')}
            title={t('mon.fullscreen')}
          >
            <Icon name={pienoSchermo ? 'close' : 'fullscreen'} size={16} />
          </button>
        )}
        <button
          type="button"
          className="simvent__tondo"
          onClick={() => agisci({ tipo: 'silenzia' })}
          aria-label={t('vent.silenzia')}
          data-fam="silenzia"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M4 4l16 16" />
          </svg>
        </button>
      </header>

      <div className="simvent__corpo">
        <nav className="simvent__maniglie">
          {maniglie(stato).map((m) => (
            <button
              key={m.chiave}
              type="button"
              className={`simvent__maniglia${m.accesa ? ' simvent__maniglia--accesa' : ''}`}
              data-fam={`maniglia-${m.chiave}`}
              onClick={() => {
                accendiSuono()
                if (cassetto === m.chiave) {
                  chiudiCassetto()
                } else {
                  setCassettoVia(null)
                  setCassetto(m.chiave)
                }
              }}
            >
              <span>{t(m.etichetta)}</span>
            </button>
          ))}
        </nav>

        <section className="simvent__onde">
          <div className="simvent__modo">
            <span className="simvent__modo-sigla">
              {inManuale ? t('vent.mode.MAN.short') : stato.modalita}
            </span>
            <span className="simvent__modo-nome">
              {inManuale ? t('vent.mode.MAN') : t(NOME_MODALITA[stato.modalita])}
            </span>
            <span className="simvent__vuoto" />
            {!inAltoFlusso && stato.ventilando && (
              <>
                {/* La velocità dello schermo: secondi da un bordo all'altro.
                    Numeri e basta, come sulla macchina — la UI resta muta. */}
                <div className="simvent__velocita" role="group">
                  {VELOCITA_SCHERMO.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={velocita === v ? 'scelto' : ''}
                      onClick={() => {
                        accendiSuono()
                        setVelocita(v)
                        setCursore(null)
                      }}
                    >
                      {v}s
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`simvent__congela${congelato !== null ? ' simvent__congela--attivo' : ''}`}
                  onClick={congela}
                  aria-pressed={congelato !== null}
                >
                  {t('vent.congela')}
                </button>
              </>
            )}
          </div>
          {inAltoFlusso ? (
            <PannelloAltoFlusso stato={stato} misure={misure} t={t} />
          ) : stato.ventilando ? (
            <div
              className={`simvent__quadro${congelato !== null ? ' simvent__quadro--fermo' : ''}`}
              onPointerDown={toccaQuadro}
            >
              {/* La chiave rimonta il quadro quando la macchina parte o si
                  ferma: la spazzata riparte dal bordo sinistro — dove l'occhio
                  la cerca — invece di continuare da dove il pennello stava. */}
              <Sweep
                key={stato.ventilando ? 'in-moto' : 'ferma'}
                channels={corsie}
                clock={clockQuadro}
                seconds={velocita}
              />
              {congelato !== null && cursore !== null && (
                <span
                  className="simvent__cursore"
                  style={{
                    left: `calc(${((cursore % velocita) / velocita).toFixed(4)} * (100% - ${
                      CORNICE_CORSIA * 2
                    }px) + ${CORNICE_CORSIA}px)`,
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          ) : (
            <div className="simvent__spento">{t('vent.state.standby')}</div>
          )}
        </section>

        <aside className="simvent__monitoraggio">
          <h2>{t('vent.monitoraggio')}</h2>
          <div className="simvent__gruppi">
            {gruppi.map((g) => (
              <div key={g.titolo}>
                <h3>{t(g.titolo)}</h3>
                <div className="simvent__tessere">
                  {g.chiavi.map((k) => (
                    <div key={k} className="simvent__tessera">
                      <span className="simvent__etichetta">{t(PARAMETRI[k].etichetta)}</span>
                      <span className="simvent__valore">
                        <b style={coloreDellAgente(k, stato.gas?.agenti)}>{scriviValore(k, misure[k])}</b>
                        <em>{t(PARAMETRI[k].unita)}</em>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {stato.gas && (
              <div>
                <h3>{t('vent.group.consumabili')}</h3>
                {/* Disegnati e non in percentuale (§402, dall'utente): sulla
                    macchina vera si guarda il barattolo e la finestrella del
                    vaporizzatore, non un numero. */}
                <div className="simvent__tessere">
                  <div className="simvent__tessera simvent__tessera--disegno">
                    <span className="simvent__etichetta">{t('vent.calce')}</span>
                    <Canister residua={stato.gas.calceResidua} />
                  </div>
                  {agente && (
                    <div className="simvent__tessera simvent__tessera--disegno">
                      <span className="simvent__etichetta">{t('vent.cartuccia')}</span>
                      <Cartuccia agente={agente} livello={stato.gas.livelli[agente]} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="simvent__barra">
        {impostazioni.map((k) => (
          <Manopola
            key={k}
            chiave={k}
            stato={stato}
            aperta={scelta === k}
            operabile={operabile}
            onApri={() => {
              accendiSuono()
              setScelta(scelta === k ? null : k)
            }}
            onGira={(verso) => {
              setGiri((n) => n + 1)
              agisci(giraParametro(k, stato, verso))
            }}
            onConferma={() => setScelta(null)}
            t={t}
          />
        ))}
      </div>

      {(cassetto ?? cassettoVia) && (
        <>
          <button
            type="button"
            className={`simvent__velo${cassetto ? '' : ' simvent__velo--via'}`}
            aria-label={t('action.close')}
            onClick={chiudiCassetto}
          />
          <aside
            className={`simvent__cassetto${cassetto ? '' : ' simvent__cassetto--via'}`}
            data-fam={`cassetto-${cassetto ?? cassettoVia}`}
            onAnimationEnd={(e) => {
              // Finita la scivolata d'uscita, il pannello si smonta davvero.
              // Solo la propria: le animazioni dei figli risalgono fin qui.
              if (e.target === e.currentTarget && !cassetto) setCassettoVia(null)
            }}
          >
            <header>
              <span>{t(NOME_CASSETTO[(cassetto ?? cassettoVia)!])}</span>
              <button type="button" onClick={chiudiCassetto} aria-label={t('action.close')}>
                ✕
              </button>
            </header>
            <div className="simvent__cassetto-corpo">
              {/* Avviare e scegliere la modalità **chiudono il cassetto**: sono
                  gesti che si fanno per vedere l'effetto, e l'effetto sta
                  dietro. Un cassetto che resta aperto sopra le curve appena
                  partite è il motivo per cui «avvia» sembrava non fare niente. */}
              {(cassetto ?? cassettoVia) === 'ventilazione' && (
                <CassettoVentilazione
                  stato={stato}
                  autotestMs={autotestMs}
                  agisci={(a) => {
                    agisci(a)
                    if (a.tipo === 'standby') chiudiCassetto()
                  }}
                  t={t}
                />
              )}
              {(cassetto ?? cassettoVia) === 'modalita' && (
                <CassettoModalita
                  stato={stato}
                  agisci={(a) => {
                    agisci(a)
                    if (a.tipo === 'modalita') chiudiCassetto()
                  }}
                  t={t}
                />
              )}
              {(cassetto ?? cassettoVia) === 'gas' && (
                <CassettoGas
                  stato={stato}
                  misure={misure}
                  riempimentoDa={riempimentoDa}
                  riempimentoCosa={riempimentoCosa}
                  clock={clockQuadro}
                  agisci={agisci}
                  t={t}
                />
              )}
              {(cassetto ?? cassettoVia) === 'manovre' && (
                <CassettoManovre
                  stato={stato}
                  manovraDa={manovraDa}
                  manovraEsito={manovraEsito}
                  clock={clock}
                  agisci={agisci}
                  t={t}
                />
              )}
              {(cassetto ?? cassettoVia) === 'umidificatore' && (
                <CassettoUmidificatore
                  stato={stato}
                  clock={clockQuadro}
                  agisci={agisci}
                  t={t}
                />
              )}
              {(cassetto ?? cassettoVia) === 'allarmi' && (
                <CassettoAllarmi stato={stato} limiti={limiti} attivi={allarmi} agisci={agisci} t={t} />
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

/**
 * Una tessera della barra: si tocca e cresce di due tasti.
 *
 * Niente tastierino e niente cursore. Un tastierino numerico su un iPad chiede
 * di guardare la tastiera invece del paziente, e un cursore su un valore
 * clinico è il modo più veloce di impostare 47 quando si voleva 50. Due tasti
 * grandi con il passo giusto sono quello che c'è sull'apparecchio, e il passo
 * lo decide `parametri.ts` — in alto flusso cambia da solo sopra i 25 l/min.
 */
function Manopola({
  chiave,
  stato,
  aperta,
  operabile,
  onApri,
  onGira,
  onConferma,
  t,
}: {
  key?: string | number
  chiave: ChiaveImpostazione
  stato: StatoVentilatore
  aperta: boolean
  operabile: boolean
  onApri: () => void
  onGira: (verso: 1 | -1) => void
  /** Il segno di spunta: «ho finito di regolare», e la tessera si richiude. */
  onConferma: () => void
  t: Translate
}) {
  const def = PARAMETRI[chiave]
  const valore = stato.impostazioni[chiave]
  return (
    <div
      className={`simvent__manopola${aperta ? ' simvent__manopola--aperta' : ''}`}
      data-fam={`manopola-${chiave}`}
    >
      <button type="button" className="simvent__manopola-corpo" onClick={onApri} disabled={!operabile}>
        <span className="simvent__etichetta">{t(def.etichetta)}</span>
        <span className="simvent__valore simvent__valore--grande">
          <b>{scriviValore(chiave, valore)}</b>
          <em>{t(def.unita)}</em>
        </span>
      </button>
      {aperta && operabile && (
        <div className="simvent__passi">
          <button type="button" onClick={() => onGira(-1)} aria-label="−">
            −
          </button>
          <button type="button" onClick={() => onGira(1)} aria-label="+">
            +
          </button>
          {/* Ogni passo è già applicato — come sulla macchina vera — quindi la
              spunta non «salva»: dice che hai finito, e richiude la tessera.
              Senza, non si capiva come uscirne (si esce anche toccando fuori,
              o aspettando: la tessera si richiude da sola). */}
          <button
            type="button"
            className="simvent__passi-conferma"
            onClick={onConferma}
            aria-label={t('vent.manopola.conferma')}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  )
}

/** I passaggi dell'autotest, nell'ordine in cui una macchina vera li fa. */
const PASSI_AUTOTEST = [
  'vent.autotest.tenuta',
  'vent.autotest.valvole',
  'vent.autotest.cella',
  'vent.autotest.compliance',
  'vent.autotest.allarmi',
] as const

/** I passaggi con quel circuito: col monotubo la macchina calibra anche la perdita del whisper (§602). */
function passiAutotest(circuito: Circuito | null | undefined): TranslationKey[] {
  if (circuito !== 'monotubo') return [...PASSI_AUTOTEST]
  return [...PASSI_AUTOTEST.slice(0, 4), 'vent.autotest.whisper', ...PASSI_AUTOTEST.slice(4)]
}

/** Quanto dura ogni passaggio dell'animazione, in millisecondi. */
const PASSO_AUTOTEST_MS = 800

/** Standby, autotest, e — in anestesia — il selettore fra pallone e meccanica. */
function CassettoVentilazione({
  stato,
  autotestMs,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  /** Quando è stato fatto l'ultimo autotest, in millisecondi epoch, o nulla. */
  autotestMs: number | null
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  /**
   * A che passaggio sta l'autotest in corso su **questo** schermo, o nulla.
   *
   * L'animazione è del device che l'ha lanciato — è un teatro di qualche
   * secondo — e solo il completamento diventa un'azione che viaggia: la regia
   * scrive `autotestA` nell'istantanea, e ogni schermo mostra «ultimo
   * autotest» aggiornato. Chiudere il cassetto a metà interrompe il test, come
   * spegnere una macchina vera durante il check: non risulta fatto.
   */
  const [passoTest, setPassoTest] = useState<number | null>(null)
  const passi = passiAutotest(stato.circuito)
  const circuiti = CIRCUITI_PER_AMBIENTE[stato.ambiente] ?? []
  const agisciRef = useRef(agisci)
  agisciRef.current = agisci
  useEffect(() => {
    if (passoTest === null) return
    if (passoTest >= passi.length) {
      agisciRef.current({ tipo: 'autotest' })
      setPassoTest(null)
      return
    }
    const id = window.setTimeout(() => setPassoTest(passoTest + 1), PASSO_AUTOTEST_MS)
    return () => window.clearTimeout(id)
  }, [passoTest, passi.length])

  const oraTest = autotestMs
    ? oraDellAula(autotestMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      <div className="simvent__riga-stato">
        <i className={stato.ventilando ? 'acceso' : ''} />
        <div>
          <small>{t('vent.drawer.stato')}</small>
          <strong>
            {stato.ventilando
              ? stato.respiro === 'manuale'
                ? t('vent.state.manuale')
                : t('vent.state.attiva')
              : t('vent.state.standby')}
          </strong>
        </div>
      </div>

      {stato.ambiente === 'anestesia' && (
        <section data-fam="sorgente">
          <h4>{t('vent.drawer.sorgente')}</h4>
          <div className="simvent__scelte">
            {(['manuale', 'meccanica'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={stato.respiro === r ? 'scelto' : ''}
                onClick={() => agisci({ tipo: 'respiro', respiro: r })}
              >
                {t(NOME_RESPIRO[r])}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ## Il circuito montato (§602)
          Si sceglie da fermi, come si monta: cambiarlo azzera l'autotest, che va
          rifatto qui sotto. Ventilando si legge e basta. */}
      {circuiti.length > 0 && (
        <section data-fam="circuito">
          <h4>{t('vent.circuito.titolo')}</h4>
          <div className="simvent__scelte">
            {circuiti.map((c) => (
              <button
                key={c}
                type="button"
                className={stato.circuito === c ? 'scelto' : ''}
                disabled={stato.ventilando || passoTest !== null}
                onClick={() => agisci({ tipo: 'circuito', circuito: c })}
              >
                {t(`vent.circuito.${c}` as TranslationKey)}
              </button>
            ))}
          </div>
          <p className="simvent__autotest-ultimo">{t('vent.circuito.nota')}</p>
        </section>
      )}

      {/* ## L'autotest, da fermi
          Il registro dell'ultima prova sta sopra il pulsante che la rifà, come
          sul pannello vero: chi accende la macchina guarda prima «quando è
          stata provata» e poi decide se riprovarla. Da ventilando il pulsante
          non c'è: nessuna macchina prova le valvole con un paziente attaccato. */}
      {!stato.ventilando && (
        <section data-fam="autotest">
          <h4>{t('vent.autotest.titolo')}</h4>
          <p className="simvent__autotest-ultimo">
            {oraTest
              ? t('vent.autotest.ultimo', { ora: oraTest })
              : t('vent.autotest.mai')}
          </p>
          {passoTest !== null && (
            <ul className="simvent__autotest-passi">
              {passi.map((chiave, i) => (
                <li
                  key={chiave}
                  data-stato={i < passoTest ? 'fatto' : i === passoTest ? 'in-corso' : 'attesa'}
                >
                  <i />
                  {t(chiave)}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="simvent__grosso simvent__grosso--tenue"
            disabled={passoTest !== null}
            onClick={() => setPassoTest(0)}
          >
            {passoTest !== null ? t('vent.autotest.incorso') : t('vent.autotest.esegui')}
          </button>
        </section>
      )}

      <button
        type="button"
        className="simvent__grosso"
        data-fam="avvia"
        disabled={passoTest !== null}
        onClick={() => agisci({ tipo: 'standby', ventilando: !stato.ventilando })}
      >
        {stato.ventilando ? t('vent.drawer.metti-in-standby') : t('vent.drawer.avvia')}
      </button>
    </>
  )
}

/** Le modalità che quell'ambiente offre, e nessun'altra. */
function CassettoModalita({
  stato,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  return (
    <div className="simvent__scelte simvent__scelte--colonna">
      {MODALITA_PER_AMBIENTE[stato.ambiente].map((m: Modalita) => (
        <button
          key={m}
          type="button"
          className={stato.modalita === m ? 'scelto' : ''}
          data-fam={`modalita-${m}`}
          onClick={() => agisci({ tipo: 'modalita', modalita: m })}
        >
          <b>{m}</b>
          <span>{t(NOME_MODALITA[m])}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Il cassetto dei gas: due vaporizzatori, la calce, e il flush.
 *
 * L'interlock non si vede da nessuna parte, ed è voluto: RIEMPI e SOSTITUISCI
 * si premono sempre, e se i gas sono aperti l'azione riesce lo stesso. La
 * regola vive nel registro e nel debriefing, non in un cartello — un
 * apparecchio vero non spiega perché una cosa non andava fatta.
 */
function CassettoGas({
  stato,
  misure,
  riempimentoDa,
  riempimentoCosa,
  clock,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  misure: Misure
  riempimentoDa: number | null
  riempimentoCosa: Consumabile | null
  clock: () => number
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  const gas = stato.gas
  if (!gas) return null
  const primario = gas.agenti[0] ?? null
  // ## Il cambio si guarda mentre succede
  //
  // Mezzo minuto è lungo, e un pulsante che si spegne e basta non dice niente:
  // qui il livello **si muove**. La cartuccia si riempie da dov'era fino in
  // cima; il canister prima si svuota — è quello vecchio che esce — e poi si
  // ricarica pieno, che è il gesto vero: non si rabbocca la calce, si cambia
  // il barattolo. Il numero accanto segue il disegno, o direbbe una cosa
  // mentre il disegno ne dice un'altra.
  const cambio = riempimentoDa !== null ? riempimentoCosa : null
  const avanzamento =
    riempimentoDa !== null
      ? Math.max(0, Math.min(1, (clock() - riempimentoDa) / RIEMPIMENTO_SECONDI))
      : 0
  const livelloCartuccia =
    primario === null
      ? 0
      : cambio?.cosa === 'cartuccia'
        ? gas.livelli[primario] + (1 - gas.livelli[primario]) * avanzamento
        : gas.livelli[primario]
  // Il canister: prima metà a scendere fino a vuoto, seconda metà a salire da
  // vuoto a pieno. È il barattolo che esce e quello nuovo che entra.
  const residuaCalce =
    cambio?.cosa === 'calce'
      ? avanzamento < 0.5
        ? gas.calceResidua * (1 - avanzamento * 2)
        : (avanzamento - 0.5) * 2
      : gas.calceResidua
  return (
    <>
      <div className="simvent__riga-stato" data-fam="gas-erogazione">
        <i className={gas.erogazione ? 'acceso' : ''} />
        <div>
          <small>{t('vent.gas.erogazione')}</small>
          <strong>{gas.erogazione ? 'ON' : 'OFF'}</strong>
        </div>
        <button
          type="button"
          className={`simvent__interruttore${gas.erogazione ? ' acceso' : ''}`}
          onClick={() => agisci({ tipo: 'gas-erogazione', erogazione: !gas.erogazione })}
          aria-label={t('vent.gas.erogazione')}
        >
          <span />
        </button>
      </div>

      <section data-fam="gas-agenti">
        <h4>{t('vent.gas.agenti', { max: MASSIMO_AGENTI })}</h4>
        <div className="simvent__scelte">
          {ORDINE_AGENTI.map((a: Agente) => {
            const montato = gas.agenti.includes(a)
            return (
              <button
                key={a}
                type="button"
                className={montato ? 'scelto' : ''}
                style={montato ? { borderColor: AGENTI[a].colore, color: AGENTI[a].colore } : undefined}
                onClick={() => agisci({ tipo: 'gas-agente', agente: a, monta: !montato })}
              >
                {AGENTI[a].sigla}
              </button>
            )
          })}
        </div>
      </section>

      {primario && (
        <section>
          <h4>{t('vent.gas.vaporizzatore')}</h4>
          <div className="simvent__consumabile">
            <Cartuccia agente={primario} livello={livelloCartuccia} />
            <div>
              <div className="simvent__consumabile-riga">
                <span>{t(AGENTI[primario].etichetta)}</span>
                <b>{Math.round(livelloCartuccia * 100)}%</b>
              </div>
              <button
                type="button"
                className="simvent__azione"
                disabled={cambio !== null}
                onClick={() => agisci({ tipo: 'riempi', consumabile: { cosa: 'cartuccia', agente: primario } })}
              >
                {cambio?.cosa === 'cartuccia' ? t('vent.gas.cambioInCorso') : t('vent.gas.riempi')}
              </button>
            </div>
          </div>
        </section>
      )}

      <section data-fam="gas-calce">
        <h4>{t('vent.gas.calce')}</h4>
        <div className="simvent__consumabile">
          <Canister residua={residuaCalce} />
          <div>
            <div className="simvent__consumabile-riga">
              <span>{t('vent.gas.canister')}</span>
              <b>{Math.round(residuaCalce * 100)}%</b>
            </div>
            <div className="simvent__consumabile-riga">
              <span>{t('vent.param.inspiratoryCo2')}</span>
              <b>{scriviValore('inspiratoryCo2', misure.inspiratoryCo2)}</b>
            </div>
            <button
              type="button"
              className="simvent__azione"
              disabled={cambio !== null}
              onClick={() => agisci({ tipo: 'riempi', consumabile: { cosa: 'calce' } })}
            >
              {cambio?.cosa === 'calce' ? t('vent.gas.cambioInCorso') : t('vent.gas.sostituisci')}
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="simvent__grosso"
        data-fam="gas-flush"
        onClick={() => agisci({ tipo: 'gas-flush' })}
      >
        {t('vent.gas.flush')}
      </button>
    </>
  )
}

/** Le due pause, e quello che misurano. */
function CassettoManovre({
  stato,
  manovraDa,
  manovraEsito,
  clock,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  manovraDa: number | null
  manovraEsito: VentIstantanea['manovraEsito']
  clock: () => number
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  // ## La misura arriva alla fine, non subito
  //
  // Una pausa tenuta dura cinque secondi: qui si vede la barra che avanza, e i
  // numeri compaiono **allo scadere** — li deposita `batti()` nell'istantanea
  // (`manovraEsito`), così tutti gli schermi leggono la stessa misura. La barra
  // è un'animazione CSS lunga quanto la manovra: il ritardo negativo la fa
  // partire dal punto giusto anche se il cassetto si apre a metà conto.
  // Il reclutamento dura un minuto, le pause cinque secondi: la barra deve
  // sapere quale sta guardando, o corre per un quinto del tempo e poi si ferma.
  const quanto = stato.manovra === 'reclutamento' ? RECLUTAMENTO_SECONDI : MANOVRA_SECONDI
  const trascorso = manovraDa !== null ? Math.max(0, Math.min(quanto, clock() - manovraDa)) : 0
  return (
    <>
      <div className="simvent__scelte simvent__scelte--colonna">
        {(['pausa-inspiratoria', 'pausa-espiratoria', 'reclutamento'] as Exclude<Manovra, null>[]).map((m) => (
          <button
            key={m}
            type="button"
            className={stato.manovra === m ? 'scelto' : ''}
            data-fam={`manovra-${m}`}
            onClick={() => agisci({ tipo: 'manovra', manovra: stato.manovra === m ? null : m })}
            disabled={!stato.ventilando || (stato.manovra !== null && stato.manovra !== m)}
          >
            <b>{t(NOME_MANOVRA[m])}</b>
          </button>
        ))}
      </div>
      {stato.manovra !== null && manovraDa !== null && (
        <section>
          <h4>{t('vent.manovra.incorso')}</h4>
          <div className="simvent__progresso" key={manovraDa}>
            <i
              style={{
                animationDuration: `${quanto}s`,
                animationDelay: `-${trascorso}s`,
              }}
            />
          </div>
          <p className="simvent__nota">
            {t(
              stato.manovra === 'reclutamento'
                ? 'vent.manovra.reclutamento.hint'
                : 'vent.manovra.incorso.hint',
            )}
          </p>
        </section>
      )}
      {stato.manovra === null && manovraEsito && (
        <section>
          <h4>{`${t('vent.manovra.esito')} — ${t(NOME_MANOVRA[manovraEsito.manovra])}`}</h4>
          {/* Interrotta: l'apparecchio non si limita a mollare la pressione,
              dice che cosa ha visto. È metà del debriefing. */}
          {manovraEsito.interrotta && (
            <p className="simvent__nota simvent__nota--allarme">
              {`${t('vent.manovra.interrotta')} — ${t(manovraEsito.interrotta)}`}
            </p>
          )}
          <div className="simvent__esito">
            {Object.entries(manovraEsito.valori).map(([nome, valore]) => (
              <div key={nome}>
                <span>{t(NOME_ESITO[nome] ?? 'vent.manovra.esito')}</span>
                <b>{valore === null ? '––' : valore}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** I limiti, uno per riga, con i due estremi che non si scavalcano. */
function CassettoAllarmi({
  stato,
  limiti,
  attivi,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  limiti: LimitiAllarme
  attivi: AllarmeAttivo[]
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
  const suona = new Set(attivi.map((a) => a.chiave))
  return (
    <div className="simvent__limiti">
      {chiavi.map((k) => {
        const def = ALLARMI[k]
        const limite = limiti[k]
        return (
          <div
            key={k}
            className={`simvent__limite${suona.has(k) ? ' simvent__limite--suona' : ''}`}
            data-fam={`limite-${k}`}
          >
            <span className="simvent__etichetta">{t(def.etichetta)}</span>
            {def.interruttore ? (
              <button
                type="button"
                className={`simvent__interruttore${limite.acceso ? ' acceso' : ''}`}
                onClick={() => agisci({ tipo: 'allarme', chiave: k, acceso: !limite.acceso })}
                aria-label={t(def.etichetta)}
              >
                <span />
              </button>
            ) : (
              (['basso', 'alto'] as const).map((estremo) =>
                limite[estremo] === null ? (
                  <span key={estremo} className="simvent__limite-vuoto">
                    ––
                  </span>
                ) : (
                  <span key={estremo} className="simvent__limite-coppia">
                    <button type="button" onClick={() => agisci({ tipo: 'limite', chiave: k, estremo, verso: -1 })}>
                      −
                    </button>
                    <b>{limite[estremo]}</b>
                    <button type="button" onClick={() => agisci({ tipo: 'limite', chiave: k, estremo, verso: 1 })}>
                      +
                    </button>
                  </span>
                ),
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * L'alto flusso, che curve non ne ha.
 *
 * Tre numeri grandi e una camera d'acqua: è tutto quello che quell'apparecchio
 * mostra, e riempire lo spazio delle curve con un'animazione del flusso
 * sarebbe inventare una macchina. L'interfaccia si sceglie qui perché cambia
 * gli estremi di tutto il resto — un junior a sessanta litri non esiste.
 */
function PannelloAltoFlusso({
  stato,
  misure,
  t,
}: {
  stato: StatoVentilatore
  misure: Misure
  t: Translate
}) {
  const af = stato.altoFlusso
  // La camera dell'acqua è dell'**umidificatore**, non dell'apparecchio: da
  // quando esiste anche in terapia intensiva sta là, e qui si legge da lì.
  const umi = stato.umidificatore
  const limiti = af ? limitiAltoFlusso(af.interfaccia) : null
  return (
    <div className="simvent__altoflusso">
      <div className="simvent__grandi">
        <div>
          <span>{t('vent.param.fgf')}</span>
          <b>{scriviValore('fgf', stato.impostazioni.fgf)}</b>
          <em>{t('vent.unit.lMin')}</em>
        </div>
        <div>
          <span>{t('vent.param.fio2')}</span>
          <b>{scriviValore('fio2', stato.impostazioni.fio2)}</b>
          <em>%</em>
        </div>
        <div>
          <span>{t('vent.param.deliveredTemperature')}</span>
          <b>{scriviValore('deliveredTemperature', misure.deliveredTemperature)}</b>
          <em>{t('vent.unit.celsius')}</em>
        </div>
      </div>
      {af && (
        <div className="simvent__consumabile">
          <CameraAcqua livello={umi?.acqua ?? 0} />
          <div>
            <div className="simvent__consumabile-riga">
              <span>{t('vent.param.waterLevel')}</span>
              <b>{Math.round((umi?.acqua ?? 0) * 100)}%</b>
            </div>
            <div className="simvent__consumabile-riga">
              <span>{t('vent.af.interfaccia')}</span>
              <b>{t(NOME_INTERFACCIA[af.interfaccia])}</b>
            </div>
            {/* La disinfezione: era un campo che nessuno mostrava e nessuno
                cambiava. Su un apparecchio che passa da un paziente all'altro
                è la prima cosa da guardare, e va vista **prima** di attaccarlo. */}
            <div className="simvent__consumabile-riga">
              <span>{t('vent.af.disinfezione')}</span>
              <b className={`simvent__disinfezione simvent__disinfezione--${af.disinfezione}`}>
                {t(NOME_DISINFEZIONE[af.disinfezione])}
              </b>
            </div>
            {limiti && (
              <div className="simvent__consumabile-riga">
                <span>{t('vent.af.portata')}</span>
                <b>
                  {limiti.fgfMin}–{limiti.fgfMax} {t('vent.unit.lMin')}
                </b>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Il cassetto dell'umidificatore: acceso, potenza, acqua.
 *
 * **La potenza è cinque tacche, non un cursore.** Su un umidificatore vero
 * sono cinque posizioni, e la cosa che si insegna è che non è «più è meglio»:
 * sopra la tacca di mezzo il circuito si bagna e le secrezioni si accumulano —
 * si vedono sulle curve, non qui — e il gesto giusto è abbassare. Per questo
 * non c'è nessuna scritta che lo spiega: chi guarda deve accorgersene dalle
 * onde, come al letto.
 *
 * In alto flusso c'è anche la disinfezione, che è il gesto che si fa fra un
 * paziente e l'altro: come l'autotest, i passaggi li anima il device e il
 * fatto viaggia.
 */
function CassettoUmidificatore({
  stato,
  clock,
  agisci,
  t,
}: {
  stato: StatoVentilatore
  clock: () => number
  agisci: (a: AzioneVentilatore) => void
  t: Translate
}) {
  const u = stato.umidificatore
  const af = stato.altoFlusso
  const [disinfettaDa, setDisinfettaDa] = useState<number | null>(null)
  if (!u) return null

  const acqua = Math.round(u.acqua * 100)
  return (
    <div className="simvent__umi">
      <div className="simvent__riga-comando">
        <span>{t('vent.umi')}</span>
        <button
          type="button"
          className={`simvent__tasto${u.acceso ? ' simvent__tasto--on' : ''}`}
          onClick={() => agisci({ tipo: 'umidificatore', acceso: !u.acceso })}
        >
          {t(u.acceso ? 'vent.on' : 'vent.off')}
        </button>
      </div>

      <div className="simvent__riga-comando">
        <span>{t('vent.umi.potenza')}</span>
        <div className="simvent__tacche">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`simvent__tacca${u.potenza === n ? ' simvent__tacca--on' : ''}`}
              onClick={() => agisci({ tipo: 'potenza', potenza: n })}
              disabled={!u.acceso}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="simvent__riga-comando">
        <span>{t('vent.umi.acqua')}</span>
        <b className={acqua < 10 ? 'simvent__acqua--bassa' : undefined}>{acqua}%</b>
      </div>

      {af && (
        <div className="simvent__riga-comando">
          <span>{t('vent.af.disinfezione')}</span>
          {disinfettaDa === null ? (
            <button
              type="button"
              className="simvent__tasto"
              onClick={() => {
                setDisinfettaDa(clock())
                // Come l'autotest: l'animazione la fa il device, il fatto va
                // in regia allo scadere.
                window.setTimeout(() => {
                  agisci({ tipo: 'disinfezione' })
                  setDisinfettaDa(null)
                }, DISINFEZIONE_SECONDI * 1000)
              }}
            >
              {t('vent.af.disinfetta')}
            </button>
          ) : (
            <span className="simvent__in-corso">{t('vent.af.disinfezioneInCorso')}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** Quanto dura il ciclo di disinfezione a schermo, in secondi. */
const DISINFEZIONE_SECONDI = 20

/**
 * Il colore dell'agente sulle sue misure (§402, dall'utente): giallo il sevo,
 * blu il desflurano, viola l'isoflurano — i colori delle bottiglie e dei
 * vaporizzatori, che in sala si riconoscono prima di leggere.
 */
function coloreDellAgente(k: ChiaveMisura, agenti: Agente[] | undefined): CSSProperties | undefined {
  const quale =
    k === 'etAgentConcentration' || k === 'fiAgentConcentration'
      ? agenti?.[0]
      : k === 'etSecondaryAgentConcentration' || k === 'fiSecondaryAgentConcentration'
        ? agenti?.[1]
        : undefined
  return quale ? { color: AGENTI[quale].colore } : undefined
}
