# Open Vent Sim 3.1

**Simulatore gratuito e open-source di ventilatore, macchina d'anestesia e alti flussi — con la regia dell'istruttore sulla rete della tua aula.**

🇬🇧 [English version](README.md) · 📅 Versione 3.1.3 — pubblicata l'8 novembre 2026 · Licenza MIT

<p align="center"><img src="docs/screenshots/10-regia-live.png" width="820" alt="La regia vede il ventilatore dello studente in diretta"></p>

> ⚠️ **Solo per la didattica.** Non è un dispositivo medico e non va mai usato per decisioni cliniche.

---

## Indice

1. [Che cosa fa](#1-che-cosa-fa)
2. [Che cosa ti serve](#2-che-cosa-ti-serve)
3. [Scaricare e installare (5 minuti)](#3-scaricare-e-installare)
4. [Lezione con la regia, passo per passo](#4-lezione-con-la-regia-passo-per-passo)
5. [Usarlo da soli](#5-usarlo-da-soli)
6. [La regia in dettaglio](#6-la-regia-in-dettaglio)
7. [Il registro della sessione](#7-il-registro-della-sessione)
8. [Se qualcosa non va](#8-se-qualcosa-non-va)
9. [Novità](#9-novità)
10. [Per sviluppatori](#10-per-sviluppatori)

---

## 1. Che cosa fa

- **Tre apparecchi in uno**: macchina d'anestesia, ventilatore di terapia intensiva (invasiva e non invasiva) e alti flussi.
- **Curve vere**: pressione, flusso e volume calcolati dal modello del polmone, con compliance che cambia con la PEEP, auto-PEEP, sforzi del paziente e asincronie.
- **Loop pressione–volume e flusso–volume**, tracce di **pressione alveolare (Palv)** e **sforzo del paziente (Pmus)**, modalità **PRVC**.
- **Regia dell'istruttore**: da un computer (o da un tablet) vedi in diretta il ventilatore di ogni studente e cambi il paziente: quadro clinico, meccanica, parametri vitali, asincronie, eventi programmati.
- **Registro della sessione** per il debriefing: chi ha fatto cosa e quando, con l'andamento dei parametri. Si stampa in PDF.
- **Guida passo passo** per chi non ha mai visto un ventilatore.
- **Niente internet, niente account**: funziona sulla rete locale della tua aula. Nessun dato esce dalla stanza.
- Italiano e inglese.

## 2. Che cosa ti serve

| Chi | Che cosa |
|---|---|
| **Istruttore** | Un computer **Windows 10/11** o **Mac** (macOS 11 o successivo). |
| **Studenti** | Un computer Windows/Mac con l'app, **oppure** un tablet/telefono con un browser qualsiasi (Safari, Chrome…). Sui tablet non si installa niente. |
| **Rete** | Tutti sulla **stessa rete Wi-Fi** (o lo stesso router). Internet **non** serve. |

> 💡 Molte reti Wi-Fi di ospedali e università **isolano i dispositivi** fra loro, e lì la regia non vede gli studenti. Se succede, usa un piccolo router tuo o l'hotspot del telefono (vedi [§8](#8-se-qualcosa-non-va)).

## 3. Scaricare e installare

Vai alla pagina **[Releases](https://github.com/fedebarra/open-vent-sim/releases/latest)** e scarica il file giusto per il tuo computer:

| Il tuo computer | File da scaricare |
|---|---|
| Windows | `OpenVentSim-3.1.3-win-x64.exe` (installazione) — oppure `OpenVentSim-3.1.3-portable.exe` (senza installare, si apre e basta) |
| Mac con chip Apple (M1, M2, M3, M4…) | `OpenVentSim-3.1.3-mac-arm64.dmg` |
| Mac con processore Intel | `OpenVentSim-3.1.3-mac-x64.dmg` |

> Se il `.dmg` non si apre, scarica il `.zip` con lo stesso nome: doppio clic per estrarlo, poi trascina **Open Vent Sim** in Applicazioni.

> Non sai che Mac hai? Menu  → **Informazioni su questo Mac**. Se vedi «Chip Apple M…» prendi `arm64`; se vedi «Processore Intel» prendi `x64`.

### Windows

1. Fai doppio clic sul file `.exe`.
2. Windows mostra una finestra blu **«Windows ha protetto il PC»**: è normale per i programmi gratuiti non firmati. Clicca **Ulteriori informazioni** → **Esegui comunque**.
3. Segui l'installazione (Avanti, Avanti, Fine). Trovi **Open Vent Sim** sul desktop.
4. La **prima volta che apri la Regia**, Windows chiede se consentire l'accesso alla rete: spunta **Reti private** (e anche **pubbliche** se la rete dell'aula è segnata come pubblica) e clicca **Consenti accesso**. Senza questo, gli studenti non si collegano.

### Mac

1. Apri il file `.dmg` e **trascina Open Vent Sim nella cartella Applicazioni**.
2. Apri Applicazioni e fai doppio clic su Open Vent Sim. Il Mac dice che **non può verificare lo sviluppatore**: clicca **Fine** (non «Sposta nel cestino»).
3. Apri **Impostazioni di Sistema → Privacy e sicurezza**, scorri in basso: accanto a «Open Vent Sim è stato bloccato» clicca **Apri comunque**, poi conferma con la password.
4. Da qui in poi si apre normalmente. Se chiede di accettare connessioni in entrata, clicca **Consenti**.

## 4. Lezione con la regia, passo per passo

### Istruttore

**1.** Apri Open Vent Sim e scegli **Regia**.

<p align="center"><img src="docs/screenshots/01-launcher.png" width="640" alt="Scelta: Regia, Ventilatore, Da solo"></p>

**2.** Si apre la regia. A sinistra trovi tutto quello che serve agli studenti: **QR code**, **indirizzo** e **PIN di 4 cifre** (in alto a destra, in giallo). Il PIN cambia a ogni avvio.

<p align="center"><img src="docs/screenshots/02-regia-empty.png" width="820" alt="Regia vuota con QR, indirizzo e PIN"></p>

Lascia questa finestra aperta per tutta la lezione: **se la chiudi, l'aula si scollega**.

### Studenti

Hanno tre modi per collegarsi; vanno bene tutti:

- **Tablet o telefono** → inquadrano il **QR code** con la fotocamera. Si apre il simulatore già collegato.
- **PC con l'app** → aprono Open Vent Sim, scelgono **Ventilatore** e cliccano sulla regia trovata. Se non compare, scrivono l'indirizzo che vedono sul tuo schermo (per esempio `192.168.1.20:8787`).
- **PC senza app** → scrivono l'indirizzo nel browser (per esempio `http://192.168.1.20:8787`).

<p align="center"><img src="docs/screenshots/05-find-instructor.png" width="560" alt="L'app trova la regia sulla rete"></p>

Se chiede il **PIN**, scrivono le 4 cifre che vedi in regia:

<p align="center"><img src="docs/screenshots/03-join-pin.png" width="560" alt="Schermata del PIN"></p>

In basso a sinistra compare un pallino: **verde «Collegato alla regia»** vuol dire che è tutto a posto.

### Lo studente accende la macchina

1. Sceglie l'apparecchio.

<p align="center"><img src="docs/screenshots/04-start.png" width="640" alt="Schermata iniziale"></p>

2. Per la terapia intensiva sceglie **invasiva** o **non invasiva**, poi conferma **peso ed età**, come su un ventilatore vero. Il quadro clinico (polmone, asincronie, tracce didattiche) non lo sceglie lo studente: lo decidi tu dalla regia.

<p align="center"><img src="docs/screenshots/06-icu-choice.png" width="420" alt="Invasiva o NIV"> <img src="docs/screenshots/07-patient.png" width="420" alt="Dati del paziente"></p>

3. Apre il pannello **STANDBY** (a sinistra) e preme **AVVIA LA VENTILAZIONE**.

<p align="center"><img src="docs/screenshots/08-standby-drawer.png" width="640" alt="Pannello Standby"></p>

<p align="center"><img src="docs/screenshots/09-icu-running.png" width="820" alt="Ventilatore in funzione"></p>

Da questo momento lo vedi in regia, curve comprese, e ogni sua azione compare nel registro a destra.

## 5. Usarlo da soli

Apri l'app e scegli **Da solo**, oppure apri il simulatore nel browser e clicca **Usa senza regia**. Senza regia, nella schermata del paziente compare il riquadro **Impostazioni dell'esercitazione** (quadro polmonare e tracce didattiche) per preparare il caso da soli. Sulla schermata iniziale c'è il pulsante **Guida passo passo**, che accompagna lo studente nella prima ventilazione.

<p align="center"><img src="docs/screenshots/20-tour.png" width="640" alt="Guida passo passo"></p>

### Curve, loop e pressioni nascoste

Sopra le curve ci sono i tasti **Curve / Loop** e, se abilitato, **Palv·Pmus**:

- **Curve / Loop**: «Loop» mostra l'anello **pressione–volume** e **flusso–volume** dell'ultimo atto. In bianco l'atto in corso, più tenui i due precedenti. **Tieni come riferimento** congela l'anello di adesso in grigio: cambi PEEP o volume e confronti.
- **Palv·Pmus** (spento di serie: su un ventilatore vero non c'è). Lo abilita la regia nella scheda *Macchina*, oppure lo studente da solo spuntando «Mostra le tracce didattiche» nella schermata del paziente. Aggiunge due tracce. **Palv** è la pressione negli alveoli (Paw meno la parte che serve a vincere la resistenza): fa vedere l'auto-PEEP prima di misurarla. **Pmus** è lo sforzo del paziente: dice *quando* tira rispetto alla macchina, cioè tutta la lettura delle asincronie.

<p align="center"><img src="docs/screenshots/21-loops.png" width="640" alt="Loop pressione-volume e flusso-volume"></p>
<p align="center"><img src="docs/screenshots/22-palv-pmus.png" width="640" alt="Tracce Palv e Pmus"></p>

**PRVC** (pressione regolata a volume controllato), in intensiva invasiva: imposti il volume, la macchina parte da un atto di prova a 10 cmH₂O e corregge la pressione di al massimo 3 cmH₂O per atto finché il volume arriva. Se la compliance cala, la pressione sale da sola: è quello che si vuole far notare.

| Anestesia | Non invasiva | Alti flussi |
|---|---|---|
| <img src="docs/screenshots/17-anesthesia.png" width="280"> | <img src="docs/screenshots/18-niv.png" width="280"> | <img src="docs/screenshots/19-highflow.png" width="280"> |

## 6. La regia in dettaglio

In alto scegli **a chi mandare** i comandi: *questo ventilatore* (quello selezionato a sinistra) oppure *tutti i ventilatori*.

| Scheda | Che cosa fai |
|---|---|
| **Paziente** | Quadri clinici con un clic (Normale, BPCO, ARDS, COVID, Anafilassi, Edema, Polmonite, Fibroscopia); compliance, resistenza, sforzo, secrezioni; SpO₂, EtCO₂, frequenza cardiaca, pressione media. Con **«Cambia in»** il cambiamento avviene gradualmente (30 s – 5 min) invece che di colpo. |
| **Asincronie** | Sforzo inefficace, doppio ciclo, reverse triggering, fame di flusso, ciclaggio precoce/ritardato, auto-trigger, con la quota degli atti coinvolti. Lo studente vede **solo le curve**, mai il nome: riconoscerla è il suo compito. |
| **Polmone** | Reclutabilità e compliance della parete: la compliance cambia con la PEEP. Avvio della **manovra di reclutamento**. |
| **Macchina** | Modalità, parametri, avvio/standby, silenzio allarmi, pause inspiratoria ed espiratoria: come se li toccasse lo studente (nel registro risultano fatti dalla regia). |
| **Eventi** | Eventi pronti (broncospasmo, tappo di muco, pneumotorace, desaturazione, ipercapnia, induzione, risveglio, decurarizzazione…). Si lanciano subito oppure si mettono in **sequenza** con i tempi, e la sequenza si salva su file per la prossima volta. |

<p align="center"><img src="docs/screenshots/11-regia-async.png" width="820" alt="Scheda Asincronie"></p>

<p align="center"><img src="docs/screenshots/12-learner-asynchrony.png" width="640" alt="Lo studente vede gli sforzi inefficaci sulle curve"></p>

<p align="center"><img src="docs/screenshots/15-regia-events.png" width="820" alt="Eventi e sequenza"></p>

**Regia sul tablet.** Nel riquadro a sinistra apri «Apri la regia su un tablet» e inquadra il QR con il **tuo** tablet: avrai la regia in mano mentre giri per l'aula. Non mostrarlo agli studenti, perché dà il controllo completo.

## 7. Il registro della sessione

1. In regia premi **● Registra sessione**. Sui ventilatori degli studenti compare **● REC**.
2. Conduci la lezione.
3. Premi **■ Ferma registrazione**: si apre il registro.

<p align="center"><img src="docs/screenshots/16-registro.png" width="820" alt="Registro della sessione"></p>

- **La scheda del giro**: titolo, nomi dei discenti, note del debriefing.
- **Parametri**: SpO₂, EtCO₂, Ppeak, PEEP, VTe, frequenza, FiO₂ e HR nel tempo. Accendi e spegni le pastiglie colorate; le tacche in alto segnano le azioni.
- **Azioni**: minuto per minuto (0:00 = inizio della registrazione), divise in *Ventilatore*, *Paziente*, *Allarmi* e *Regia*. Più ritocchi della stessa manopola nello stesso minuto stanno su una riga sola; cliccala per vederli tutti.
- **Stampa / PDF**, **Salva registro** (file `.json` da riaprire dopo con «Apri registro salvato») e **CSV** per Excel.

Il registro resta salvato anche se chiudi e riapri la regia.

## 8. Se qualcosa non va

| Problema | Soluzione |
|---|---|
| Lo studente **non trova la regia** o il QR non si apre | Controlla che sia sulla **stessa Wi-Fi** (non la rete «ospiti»). Su Windows, la prima volta bisogna aver cliccato **Consenti accesso** (vedi §3); se l'hai negato: *Pannello di controllo → Windows Defender Firewall → Consenti app* → spunta Open Vent Sim. |
| Funziona su un PC ma non sui telefoni | La rete Wi-Fi isola i dispositivi («client isolation»), cosa comune negli ospedali. Usa un router tuo o l'**hotspot del telefono**: collega tutti lì, compreso il computer della regia. |
| «PIN sbagliato» | Il PIN cambia a ogni avvio della regia: copia quello che vedi adesso, in alto a destra. |
| Il pallino in basso diventa **arancione** («Rete persa – ricollego…») | Non toccare niente: si ricollega da solo appena la rete torna, e il ventilatore continua a funzionare. |
| «Aperto in un'altra finestra» | Lo stesso ventilatore è aperto in due schede: chiudine una. |
| L'indirizzo è cambiato dalla volta scorsa | È normale: dipende dal router. Usa sempre quello che la regia mostra **oggi**. |
| La porta 8787 è occupata | La regia usa da sola la successiva (8788, 8789…): l'indirizzo giusto è sempre quello sullo schermo. |
| Il Mac dice che l'app è «danneggiata» | Apri il Terminale e scrivi `xattr -cr "/Applications/Open Vent Sim.app"`, poi riapri. |
| Voglio l'interfaccia vecchia (2.x) | Nel browser aggiungi `?legacy=1` all'indirizzo, da soli. |

## 9. Novità

### 3.1.3 — 8 novembre 2026

- Il piè di pagina mostra la versione vera dell'app (prima diceva sempre 2.0.0).
- Tolti dalla schermata iniziale i pulsanti che non facevano niente (registrazione, impostazioni, manuale): la registrazione si avvia dalla regia.

### 3.1.2 — 8 novembre 2026

- Lo studente collegato alla regia inserisce solo peso ed età: quadro polmonare e tracce didattiche li decide l'istruttore. Da soli restano disponibili, separati come «Impostazioni dell'esercitazione».

### 3.1.1 — 8 novembre 2026

- Barra dei parametri: i nomi lunghi («Pausa inspiratoria») non vanno più a capo; sulla tessera c'è il nome corto, quello intero nel suggerimento.

### 3.1 — 8 novembre 2026

- **Loop** pressione–volume e flusso–volume, con anello di riferimento da confrontare.
- Tracce **Palv** (pressione alveolare) e **Pmus** (sforzo del paziente).
- Modalità **PRVC** in intensiva invasiva.
- Corretto: un paziente che ricomincia a respirare alla stessa frequenza della macchina (decurarizzazione) ora mostra gli sforzi sulle curve.

### 3.0 — 8 novembre 2026

- **Regia sulla rete locale**: server integrato nell'app, QR, PIN, ricerca automatica della regia, riconnessione automatica, più ventilatori insieme, regia anche da tablet.
- **Nuove schermate e nuovo motore** presi dal Sim Scenario Creator: un solo layout per anestesia, intensiva invasiva e NIV, alti flussi. Polmone con compliance dipendente dalla PEEP, auto-PEEP, sforzo del paziente e sette asincronie, manovra di reclutamento, consumabili, umidificatore.
- **Registro della sessione** nello stile dello Scenario Creator, avviato dalla regia, con stampa in PDF.
- **Guida passo passo** (familiarizzazione), in italiano e inglese.
- **App desktop** per Windows e Mac; funziona **senza internet** (prima React e Tailwind arrivavano da CDN esterni).
- Nuova grafica della schermata iniziale, con icone originali.
- Lingua presa dal sistema e ricordata.

## 10. Per sviluppatori

```bash
git clone https://github.com/fedebarra/open-vent-sim.git
cd open-vent-sim
npm install
npm run dev            # sviluppo, http://localhost:3000 (solo simulatore)
npm run server         # build + server d'aula sulla rete locale (porta 8787)
npm run desktop        # app Electron
npm test               # test unitari + test del server
npm run test:e2e       # test end-to-end (regia + studenti in due browser)
npm run screenshots    # rigenera tutte le immagini di questo README
npm run dist:mac       # installer .dmg   (npm run dist:win per Windows)
```

- `device/`: motore e schermate del ventilatore (dal Sim Scenario Creator, nomi originali per poterli confrontare).
- `remote/`: regia, collegamento, registro. `server/ovs-server.mjs`: server HTTP + WebSocket + annuncio UDP sulla rete locale. `electron/`: app desktop. `tour/`: guida passo passo.
- Le release si costruiscono da sole con GitHub Actions quando si pubblica un tag `v*`.

**Requisiti per lo sviluppo:** Node.js 20 o successivo.

---

### Ringraziamenti

Sviluppato all'Università del Piemonte Orientale, Novara. Gruppo clinico: F.L. Barra MD, E. Moro MD, L. Carenzo MD, A. Costa MD, G. Rodella RN, R. Vaschetto MD PhD. Facilitatori tecnici: S. Ricci PhD, J. Travenec MSc. Grazie a tutti gli specializzandi di Anestesia che hanno dato il loro contributo.

**Immagini per presentazioni e articoli:** in [`docs/press/`](docs/press) ci sono gli screenshot in alta risoluzione (2880×1800), in italiano e in inglese, liberi da usare con la licenza del progetto.

**Supporto:** [Issues](https://github.com/fedebarra/open-vent-sim/issues) · federico.barra@med.uniupo.it

**Licenza:** MIT. Le icone sono disegni originali del progetto.
