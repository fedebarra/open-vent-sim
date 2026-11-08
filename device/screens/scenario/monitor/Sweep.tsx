/**
 * Le corsie che scorrono: un pennello che attraversa lo schermo e cancella
 * davanti a sé.
 *
 * ## Perché il pennello e non il nastro
 *
 * Ci sono due modi di far muovere una traccia. Il nastro scorre da destra a
 * sinistra e la punta resta ferma sul bordo; il pennello sta fermo sullo
 * schermo, disegna da sinistra a destra e quando arriva in fondo ricomincia,
 * cancellando la traccia vecchia un dito prima di riscriverla.
 *
 * I monitor da posto letto fanno il secondo, e non per gusto: il nastro
 * obbligherebbe a ridisegnare **tutta** la finestra ad ogni fotogramma — otto
 * secondi di curva per sei corsie, sessanta volte al secondo — mentre il
 * pennello disegna solo i due o tre millimetri passati dall'ultimo fotogramma e
 * lascia stare il resto. Su un portatile che sta anche generando uno scenario è
 * la differenza fra una traccia liscia e una a scatti.
 *
 * ## Un solo orologio per tutte le corsie
 *
 * Le curve sono sei ma il tempo è uno: la pletismografica deve battere insieme
 * al QRS che si vede sopra, e con un `requestAnimationFrame` per corsia i
 * fotogrammi si sfaserebbero di qualche millisecondo ciascuno — abbastanza
 * perché l'onda di polso sembri arrivare prima del battito che la causa.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export interface SweepChannel {
  key: string
  /** Il colore della traccia. Sono quelli convenzionali dell'area critica. */
  color: string
  /** Il valore della curva a `t` secondi dall'accensione. */
  at: (t: number) => number
  /** Fondo scala verticale, nell'unità della curva. Può cambiare nel tempo. */
  range: () => [number, number]
  /**
   * Gli istanti da disegnare in un colore diverso, dentro la stessa curva.
   *
   * Serve al ventilatore: i cento millisecondi del **trigger** — la pressione
   * che scende sotto la PEEP e il flusso che va negativo — si colorano di
   * bianco, perché sono l'unico punto in cui si legge che quell'atto l'ha
   * chiesto il paziente e non l'orologio. È una marcatura dell'apparecchio,
   * come i pallini del sincronismo, e non un pezzo di segnale: per questo la
   * curva non cambia forma, cambia solo colore.
   */
  evidenzia?: (t: number) => boolean
  /** Il colore dell'evidenza. Bianco se non si dice altro. */
  coloreEvidenza?: string
  /** L'etichetta in alto a sinistra della corsia. */
  label: string
  /** La scala, scritta piccola accanto all'etichetta: «0 – 50 mmHg». */
  scale?: string
  /**
   * Un numero scritto in fondo alla riga dell'etichetta, dalla parte opposta.
   *
   * Serve al ventilatore, dove accanto alla curva della pressione sta il picco
   * misurato e accanto a quella del volume il corrente: sul monitor il numero
   * ha una colonna sua, qui la corsia è larga e la colonna sarebbe sprecata.
   * Non è una funzione del tempo di proposito — sono misure che cambiano al
   * ritmo della regia, non a quello dei fotogrammi, e farle passare di qui le
   * ricalcolerebbe sessanta volte al secondo per niente.
   */
  value?: string
  /**
   * Che cosa fare toccando l'etichetta.
   *
   * Serve alla derivazione dell'ECG: su un monitor vero l'etichetta della
   * traccia **è** il comando che la cambia, e cercarla in un menù sarebbe
   * inventare un apparecchio che non esiste. Senza, l'etichetta resta quello
   * che era — una scritta.
   */
  onLabel?: () => void
  /** Quanto spazio prende questa corsia rispetto alle altre. */
  weight?: number
  /**
   * Gli istanti da segnare in cima alla corsia, fra `from` e `to`.
   *
   * Serve alla cardioversione sincronizzata: il monitor segna il punto su cui
   * scaricherebbe, cioe' la R, e chi conduce vede **se il sincronismo aggancia
   * davvero**. Un bersaglio che casca sull'onda T invece che sulla R e' la
   * ragione per cui la sincronizzazione esiste, e senza i segni non si puo'
   * mostrare.
   *
   * Si chiede sulla stessa finestra che si sta disegnando: i segni scorrono col
   * pennello e li cancella lui, senza uno stato in piu' da tenere.
   */
  marks?: (from: number, to: number) => number[]
  /**
   * La corsia che **aspetta il cavo**: linea tratteggiata, come su un monitor
   * vero acceso senza il paziente attaccato. Non è un allarme e non è un
   * guasto — è il posto apparecchiato.
   */
  dashed?: boolean
  /**
   * Quanti secondi di curva stanno in **questa** corsia, se non sono quelli
   * di tutte le altre.
   *
   * Il manuale tiene tre gruppi di velocità (p. 38): le curve respiratorie
   * vanno a 6,25 mm/s contro i 25 delle altre, cioè quattro volte più piano —
   * su una corsia larga otto secondi di ECG stanno trentadue secondi di CO₂,
   * e si vedono dieci atti invece di due. È la corsia della foto.
   */
  seconds?: number
  /**
   * Le righe orizzontali della griglia, nell'unità della curva, con il numero
   * scritto a sinistra. Sulle pressioni il manuale mette il fondo scala in alto
   * e lo zero in basso (p. 211); sulla CO₂ le due righe intermedie.
   */
  griglia?: number[]
  /** Se le righe della griglia si scrivono con il loro numero. */
  grigliaSenzaNumeri?: boolean
  /** La curva **riempita** fino allo zero, come la CO₂ dell'IntelliVue. */
  riempi?: boolean
  /**
   * La barra di calibrazione sotto l'etichetta: «1mV» sull'ECG (p. 131),
   * alta quanto quel valore nella scala della corsia.
   */
  calibrazione?: { valore: number; testo: string }
}

/** Quanti secondi di curva stanno da un bordo all'altro, se nessuno lo dice. */
const SWEEP_SECONDS = 8

/** Quanto è largo il tratto cancellato davanti al pennello, in frazione di schermo. */
const GAP = 0.025

/**
 * Oltre quanti secondi di ritardo il pennello **abbandona** il tratto perduto
 * invece di ridisegnarlo, in `frame()` qui sotto.
 *
 * Non è un limite di correttezza — `paint()` sa disegnare una finestra di
 * qualunque durata, campione per campione — è un limite di **tempo di
 * calcolo**: alla velocità dell'ECG (fino a 300 campioni al secondo, sei
 * corsie) un buco di un minuto sono centomila valutazioni, qualche
 * millisecondo. Un buco di dieci minuti — la scheda lasciata in un secondo
 * piano mentre altrove si prepara la stanza — sarebbero decine di milioni,
 * un fotogramma che blocca la pagina invece di disegnarla.
 *
 * Prima la soglia era 0,5 secondi: bastava una scheda passata in secondo
 * piano — il browser **sospende** `requestAnimationFrame` quando una scheda
 * non è quella attiva, non lo rallenta soltanto — o anche un fotogramma
 * pesante per superarla, e il pennello abbandonava un tratto che gli sarebbe
 * costato pochi millisecondi ridisegnare. A schermo: pezzi di traccia
 * scollegati ogni volta che si tornava a guardare il monitor, sui pazienti
 * osservati da schede diverse della stessa aula — esattamente l'uso normale
 * di «anteprima, regia, monitor in sala, iPad» sullo stesso dispositivo.
 */
const SALTO_ABBANDONO = 60

export function Sweep({
  channels,
  clock,
  labelSide = 'sinistra',
  seconds: secondiComuni = SWEEP_SECONDS,
}: {
  /** OVS: no @types/react in this project, so `key` must be declared. */
  key?: string | number
  channels: SweepChannel[]
  /**
   * Quanti secondi di curva stanno da un bordo all'altro.
   *
   * Il monitor tiene gli otto secondi di sempre — i venticinque millimetri al
   * secondo della carta. Il ventilatore no: un atto respiratorio dura cinque
   * secondi, e a otto per schermata se ne vede uno e mezzo. Sulle macchine vere
   * la velocità si sceglie, e cambia che cosa si riesce a leggere: il singolo
   * atto da vicino, o cinque‑sei atti in fila per vedere il **pattern** — che è
   * dove si riconoscono le asincronie.
   */
  seconds?: number
  /**
   * Da che parte stanno le etichette delle curve.
   *
   * I Philips le scrivono in alto a sinistra, prima che la traccia cominci; il
   * LIFEPAK le mette **a destra**, dove il pennello arriva. Non è una
   * preferenza grafica: chi ha imparato su un apparecchio le cerca dove
   * quell'apparecchio le tiene.
   */
  labelSide?: 'sinistra' | 'destra'
  /**
   * Il tempo del monitor in secondi. Uno solo per tutta la finestra — ed è
   * anche il fermo immagine: un orologio che smette di avanzare lascia il
   * pennello dov'è, senza che qui dentro ci sia un caso in più da trattare.
   */
  clock: () => number
}) {
  const canvases = useRef(new Map<string, HTMLCanvasElement>())
  const drawn = useRef(new Map<string, number>())
  const latest = useRef(channels)
  latest.current = channels
  /**
   * Il tempo a cui questo schermo ha cominciato a disegnare.
   *
   * Serve a far **partire il pennello dal bordo sinistro**: la mappa fra tempo
   * e pixel usava l'orologio assoluto (`t % seconds`), quindi uno schermo
   * acceso a metà finestra vedeva la traccia nascere in mezzo — su un
   * apparecchio vero la spazzata comincia da sinistra, ed è lì che l'occhio la
   * cerca. L'origine è **di questo schermo** e non dell'istantanea: sposta solo
   * dove sta il pennello, non che cosa disegna — la forma dell'onda resta la
   * funzione del tempo condiviso, identica su tutti gli schermi.
   */
  const origine = useRef<number | null>(null)

  /**
   * L'aggancio del canvas, **stabile**.
   *
   * Era una funzione scritta dentro il JSX, quindi nuova ad ogni render: React
   * stacca e riattacca il riferimento ogni volta che l'identità cambia, e lo
   * stacco passava dal ramo `null` che cancellava anche `drawn` — cioè la
   * memoria di dove era arrivato il pennello. Risultato: ad ogni render la
   * traccia ripartiva da `adesso - 0,02 s`, e sullo schermo restavano trattini
   * di due pixel invece di una curva.
   *
   * Sul monitor non si vedeva perché le sue corsie si ridisegnano poco; sul
   * ventilatore, che riceve un'istantanea ogni due secondi e ha tre curve, si è
   * visto al primo scenario aperto. Adesso la funzione è una sola per tutta la
   * vita del componente, e chi se ne va lo ripulisce l'effetto qui sotto.
   */
  const attacca = useCallback((el: HTMLCanvasElement | null) => {
    const chiave = el?.dataset.channel
    if (el && chiave) canvases.current.set(chiave, el)
  }, [])

  // Le corsie possono cambiare mentre il monitor è acceso: chi conduce accende
  // la capnografia a metà scenario, e il canvas nuovo va osservato anche lui.
  const chiavi = channels.map((channel) => channel.key).join('|')

  // Le dimensioni vere del canvas, in pixel del dispositivo: senza, su uno
  // schermo a densità doppia la traccia è sfocata come una fotografia stirata.
  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const canvas = entry.target as HTMLCanvasElement
        const dpr = window.devicePixelRatio || 1
        const width = Math.max(1, Math.round(entry.contentRect.width * dpr))
        const height = Math.max(1, Math.round(entry.contentRect.height * dpr))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
          // Ridimensionare svuota il canvas: la traccia riparte da capo, ed è
          // giusto così — quello che c'era era disegnato con un'altra scala.
          drawn.current.delete(canvas.dataset.channel ?? '')
        }
      }
    })
    for (const canvas of canvases.current.values()) observer.observe(canvas)
    // Le corsie spente se ne vanno di qui: chi conduce toglie la capnografia e
    // il suo canvas non c'è più, ma la mappa lo terrebbe per sempre.
    const vive = new Set(chiavi.split('|'))
    for (const chiave of [...canvases.current.keys()]) {
      if (!vive.has(chiave)) {
        canvases.current.delete(chiave)
        drawn.current.delete(chiave)
      }
    }
    return () => observer.disconnect()
  }, [chiavi])

  useEffect(() => {
    let raf = 0

    /**
     * Disegna da `from` a `to`, e **cancella da `pulisciDa`**.
     *
     * I due non coincidono quando la finestra ha perso fotogrammi: là il
     * pennello riparte da adesso — ridisegnare i minuti perduti sarebbero
     * migliaia di battiti in un fotogramma — ma quello che ha **scavalcato** va
     * pulito lo stesso, o restano i pixel della spazzata precedente. Sono loro
     * i pezzi di tracciato scollegati e i tratti piatti che si vedevano fra un
     * respiro e l'altro.
     */
    const paint = (channel: SweepChannel, from: number, to: number, pulisciDa: number) => {
      const canvas = canvases.current.get(channel.key)
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const { width: w, height: h } = canvas
      const [low, high] = channel.range()
      const span = high - low || 1
      const dpr = window.devicePixelRatio || 1
      // La corsia può andare a una velocità sua: vedi `SweepChannel.seconds`.
      const seconds = channel.seconds ?? secondiComuni

      // L'origine sposta la spazzata perché il primo fotogramma cada sul bordo
      // sinistro; il modulo tiene il resto dei giri come prima.
      const sfasa = origine.current ?? 0
      const x = (t: number) => ((((t - sfasa) % seconds) + seconds) % seconds / seconds) * w
      const y = (value: number) => {
        const k = (value - low) / span
        // Un margine sopra e sotto: una curva che tocca il bordo si legge come
        // una curva tagliata, e non si distingue da una che esce davvero.
        return h - (0.06 + 0.88 * Math.max(0, Math.min(1, k))) * h
      }

      // ## Il pennello cancella **tutto quello che scavalca**, non una finestrella
      //
      // Prima puliva solo il tratto davanti a sé, largo `GAP`. Va bene finché
      // ogni fotogramma avanza di due pixel; ma quando la finestra perde
      // fotogrammi — un'altra scheda in primo piano, il portatile che rallenta,
      // un render pesante — il pennello **salta in avanti di decine di pixel** e
      // tutto quello che sta in mezzo resta disegnato: sono i pixel della
      // spazzata **precedente**, cioè respiri di trenta secondi fa. A schermo si
      // legge come una curva che salta: pezzi di atti scollegati e tratti
      // orizzontali piatti in mezzo a quelli nuovi. È il difetto che si vedeva
      // sul ventilatore e non sul monitor, perché le sue corsie si ridisegnano
      // molto di più.
      //
      // Adesso si cancella dall'inizio del tratto che si sta per disegnare fino
      // a `GAP` oltre la testa: quello che il pennello attraversa lo pulisce,
      // quanto è lungo il salto.
      // La larghezza si calcola **dal tempo**, non dalla differenza fra due x:
      // quelle sono già passate dal modulo, e quando la spazzata gira attorno
      // al bordo destro la sottrazione diventa negativa. Girata a modulo dava
      // quasi tutto lo schermo — e a quadro **congelato**, dove il tempo non
      // avanza, cancellava la tela intera invece di lasciarla ferma.
      const inizio = x(pulisciDa)
      const avanzata = Math.max(0, to - pulisciDa)
      const larghezza = (avanzata / seconds) * w + GAP * w
      if (larghezza >= w) {
        // Un salto più lungo dell'intero schermo: non resta niente da salvare.
        ctx.clearRect(0, 0, w, h)
      } else {
        ctx.clearRect(inizio, 0, larghezza, h)
        if (inizio + larghezza > w) ctx.clearRect(0, 0, inizio + larghezza - w, h)
      }

      ctx.strokeStyle = channel.color
      ctx.lineWidth = Math.max(1, 1.6 * dpr)
      ctx.lineJoin = 'round'
      ctx.lineCap = channel.dashed ? 'butt' : 'round'
      ctx.setLineDash(channel.dashed ? [7 * dpr, 7 * dpr] : [])
      // Il pennello disegna due pixel per fotogramma, e ogni tratto nuovo
      // ripartirebbe dall'inizio del motivo: tanti inizi di tratteggio uno
      // dietro l'altro sono una linea piena. L'offset ancora il motivo allo
      // schermo, non al tratto.
      ctx.lineDashOffset = channel.dashed ? -x(from) : 0
      ctx.beginPath()

      // Il passo di campionamento: mai più rado di un pixel, mai più fitto di
      // trecento campioni al secondo — sotto quella soglia la punta della R
      // cade fra due campioni e la traccia perde altezza a caso.
      const step = Math.min(1 / 300, seconds / w)
      // **Il colore può cambiare in mezzo alla corsia.** Quando l'evidenza si
      // accende o si spegne si chiude il tratto, si cambia pennello e si
      // riparte **dallo stesso punto**: senza il `moveTo` sul punto appena
      // disegnato resterebbe un buco fra i due colori, che a schermo si legge
      // come una curva interrotta.
      const evidenzia = channel.evidenzia
      const acceso = channel.coloreEvidenza ?? '#ffffff'
      let inEvidenza = false
      let previous = -1
      // ## La curva riempita
      //
      // La CO₂ dell'IntelliVue è un'area, non una riga: il tratto appena
      // disegnato si chiude in basso sullo zero e si riempie di un grigio
      // trasparente, un fotogramma dopo l'altro. Si spezza dove la spazzata
      // gira attorno al bordo, come il tratto.
      //
      // ## Un `Path2D` a parte, non il tracciato del pennello
      //
      // `riempi()` chiudeva l'area con `ctx.beginPath()` — che non «apre un
      // secondo disegno», **azzera il tracciato corrente**. Il pennello che
      // stava accumulando `moveTo`/`lineTo` per il tratto (colorato con
      // `ctx.stroke()` una volta sola, in fondo alla funzione) veniva
      // cancellato ogni volta che l'area si chiudeva a metà fotogramma — cioè
      // ogni volta che la spazzata gira attorno al bordo destro, sulla CO₂
      // una volta ogni trentadue secondi. Il risultato è un pezzo di traccia
      // che il pennello ha calcolato e non ha mai disegnato: la corsia con un
      // buco esatto in quel punto, ripetuto a ogni giro.
      //
      // Un `Path2D` proprio non tocca il tracciato del contesto: si riempie
      // per conto suo, e il pennello continua ad accumulare il suo senza
      // saperlo.
      const fondo = y(Math.max(low, 0))
      const area: [number, number][] = []
      const riempi = () => {
        if (!channel.riempi || area.length < 2) {
          area.length = 0
          return
        }
        const sagoma = new Path2D()
        sagoma.moveTo(area[0][0], fondo)
        for (const [ax, ay] of area) sagoma.lineTo(ax, ay)
        sagoma.lineTo(area[area.length - 1][0], fondo)
        sagoma.closePath()
        ctx.fillStyle = 'rgba(160, 166, 172, 0.55)'
        ctx.fill(sagoma)
        area.length = 0
      }
      // ## L'ultimo campione è **`to`**, non l'ultimo multiplo del passo
      //
      // `for (t = from; t <= to; t += step)` si ferma sull'ultimo multiplo del
      // passo che ci sta dentro, e fra quello e `to` resta un avanzo — fino a
      // un passo intero — che **nessuno disegna**: il fotogramma dopo riparte
      // da `to` con un `moveTo`, cioè alza la penna proprio su quell'avanzo.
      //
      // Sul tratto piatto non si vede: l'avanzo vale zero pixel di salita.
      // Dove la curva corre — la salita della pletismografica, la R, il fronte
      // della pressione — in tre millesimi di secondo si fanno sei o sette
      // pixel di altezza, e quei sei pixel restano bianchi ad **ogni**
      // fotogramma: la traccia esce a trattini, «come disegnata a matita». È il
      // difetto che si vedeva su tutte le corsie insieme, e che non c'entra
      // niente con i buchi del §179 — quelli erano i salti dell'orologio,
      // questo è la giuntura fra un fotogramma e il successivo, sempre lì.
      //
      // Chiudendo ogni fotogramma **esattamente** su `to`, il primo punto del
      // fotogramma dopo cade sullo stesso istante e sullo stesso pixel: i due
      // tratti si toccano e la linea torna piena. Segnalato dall'uso il 2
      // settembre 2026.
      for (let t = from; ; t += step) {
        const ultimo = t >= to
        const istante = ultimo ? to : t
        const px = x(istante)
        const py = y(channel.at(istante))
        const vuole = evidenzia ? evidenzia(istante) : false
        if (vuole !== inEvidenza) {
          ctx.stroke()
          inEvidenza = vuole
          ctx.strokeStyle = vuole ? acceso : channel.color
          ctx.beginPath()
          ctx.moveTo(px, py)
          previous = px
          if (ultimo) break
          continue
        }
        if (previous < 0 || px < previous) {
          riempi()
          ctx.moveTo(px, py)
        } else ctx.lineTo(px, py)
        area.push([px, py])
        previous = px
        if (ultimo) break
      }
      riempi()
      ctx.stroke()

      // ## I bersagli del sincronismo sono **pallini**, non trattini
      //
      // È la convenzione, e non è arbitraria: un trattino verticale su una
      // traccia ECG si legge come un artefatto o come uno spicco di pacemaker
      // — cose che stanno *dentro* il segnale — mentre un pallino sopra il
      // complesso si legge subito come una marcatura dell'apparecchio. Su un
      // defibrillatore vero sono pallini, e chi cerca «il pallino su ogni R»
      // per controllare che il sincronismo abbia agganciato deve trovarlo.
      const segni = channel.marks?.(from, to) ?? []
      if (segni.length > 0) {
        ctx.fillStyle = channel.color
        const raggio = Math.max(1.6, 2.6 * dpr)
        for (const istante of segni) {
          ctx.beginPath()
          ctx.arc(x(istante), 0.09 * h, raggio, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const frame = () => {
      const now = clock()
      // La prima passata di sempre fissa l'origine: da qui in poi il bordo
      // sinistro è «quando questo schermo ha cominciato a guardare».
      if (origine.current === null) origine.current = now
      for (const channel of latest.current) {
        const last = drawn.current.get(channel.key)
        // Alla prima passata, e dopo un salto **lungo** (`SALTO_ABBANDONO`:
        // la scheda lasciata in un secondo piano per un bel po', lo schermo
        // bloccato), si riparte da adesso invece di disegnare i minuti perduti
        // — sarebbero migliaia di battiti da calcolare in un fotogramma. Sotto
        // quella soglia si ridisegna **tutto** il tratto perduto: costa poco,
        // e un tratto ridisegnato è una traccia continua invece di un buco.
        // Mai prima dell'origine: un `from` più vecchio finirebbe, col modulo,
        // in fondo a destra — un puntino orfano sul bordo opposto.
        const from = Math.max(
          origine.current,
          last === undefined || now - last > SALTO_ABBANDONO ? now - 0.02 : last,
        )
        // Da dove pulire: **l'ultima posizione del pennello**, non da dove si
        // ricomincia a disegnare. Dopo un salto le due cose sono diverse, ed è
        // quella differenza che lasciava i residui.
        paint(channel, from, now, last ?? from)
        drawn.current.set(channel.key, now)
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // `seconds` sta fra le dipendenze perché cambia la mappa fra tempo e pixel:
    // quello che è già disegnato è disegnato con l'altra scala, e va buttato —
    // lo fa l'effetto qui sotto.
  }, [clock, secondiComuni])

  useEffect(() => {
    for (const canvas of canvases.current.values()) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    }
    drawn.current.clear()
  }, [secondiComuni])

  /**
   * Dove cade un valore nella corsia, in percento dall'alto: la stessa mappa
   * del pennello (`y`), per la griglia e la barra di calibrazione disegnate
   * nel DOM. Stanno **sotto** la tela e non dentro: il pennello cancella quello
   * che scavalca, e una griglia sulla tela sparirebbe a ogni giro.
   */
  const percentoDallAlto = (channel: SweepChannel, value: number) => {
    const [low, high] = channel.range()
    const k = (value - low) / (high - low || 1)
    return (1 - (0.06 + 0.88 * Math.max(0, Math.min(1, k)))) * 100
  }

  const total = channels.reduce((sum, channel) => sum + (channel.weight ?? 1), 0) || 1

  return (
    <div className="simmon__waves">
      {channels.map((channel) => (
        <div
          key={channel.key}
          className={`simmon__lane simmon__lane--${labelSide}${channel.onLabel ? ' simmon__lane--tocca' : ''}`}
          style={{ flexGrow: (channel.weight ?? 1) / total }}
          /* Sul vetro si tocca **la curva**, non un'etichetta da otto punti:
             se la corsia ha un comando — l'ECG, per cambiare derivazione —
             tutta la corsia lo è. Sull'iPad il dito cade sulla traccia, mai
             sulla scritta. */
          onClick={channel.onLabel}
        >
          {/* Un'etichetta vuota **non si disegna**: c'è chi scrive il nome
              della curva altrove sul vetro — il LIFEPAK lo scrive accanto ai
              joule, nello stesso angolo — e un elemento vuoto lì resterebbe a
              coprire quello che c'è sotto. Un `<button>` senza testo, poi, è
              un bersaglio senza nome per chi legge a voce: la corsia intera
              porta già lo stesso comando. */}
          {channel.label ? (
            channel.onLabel ? (
              <button
                type="button"
                className="simmon__lane-label simmon__lane-label--tocca"
                style={{ color: channel.color }}
                onClick={(e) => {
                  // Il clic sale anche alla corsia, che ha lo stesso comando:
                  // senza fermarlo qui il pannello si aprirebbe e richiuderebbe.
                  e.stopPropagation()
                  channel.onLabel?.()
                }}
              >
                {channel.label}
                {channel.scale && <em>{channel.scale}</em>}
              </button>
            ) : (
              <span className="simmon__lane-label" style={{ color: channel.color }}>
                {channel.label}
                {channel.scale && <em>{channel.scale}</em>}
              </span>
            )
          ) : null}
          {channel.value !== undefined && (
            <span className="simmon__lane-value" style={{ color: channel.color }}>
              {channel.value}
            </span>
          )}
          {channel.griglia?.map((valore) => (
            <span
              key={valore}
              className="simmon__lane-griglia"
              style={{ top: `${percentoDallAlto(channel, valore)}%`, color: channel.color }}
            >
              {!channel.grigliaSenzaNumeri && <em>{valore}</em>}
            </span>
          ))}
          {channel.calibrazione && (
            <span
              className="simmon__lane-cal"
              style={{
                color: channel.color,
                top: `${percentoDallAlto(channel, channel.calibrazione.valore)}%`,
                height: `${percentoDallAlto(channel, 0) - percentoDallAlto(channel, channel.calibrazione.valore)}%`,
              }}
            >
              <em>{channel.calibrazione.testo}</em>
            </span>
          )}
          <canvas data-channel={channel.key} ref={attacca} />
        </div>
      ))}
    </div>
  )
}
