# Piano: assistenza neurale (EAdi), NIV e alto flusso

Scritto il 20/11/2026 dopo aver letto i sette documenti scaricati in `~/Downloads` quella sera.
**File di lavoro locale, da non committare**: cita prodotti e marchi del produttore. Quello che
finisce nel repo pubblico usa nomi nostri e descrive la fisiologia, non il prodotto.

## Le fonti lette

| File | Cosa ci serve |
|---|---|
| `NAVA.pdf` (study guide, 52 pp.) | fisiologia del segnale, regole del modo: livello, trigger, ciclaggio, backup, passaggio al supporto di pressione, allarmi, troubleshooting |
| `servo-u-n-i-nava-trainm-flowchart-adult…pdf` | valori di partenza e bersagli clinici nell'adulto (invasiva e NIV), troubleshooting |
| `servo-u-n-i-nava-flyer…pdf` | Edi come «segno vitale» in tutte le fasi: prima dell'intubazione, invasiva, NIV, alto flusso, dopo l'estubazione |
| `nava-nicu.pdf` (presentazione NICU) | titolazione a «breakpoint» in tre fasi, apnea time, backup, letture cliniche di Edi peak/min |
| `navasetup.pdf` (procedura neonatale) | montaggio del circuito e del catetere: utile per i passi del tour, non per il motore |
| `servo-u-4.1…startup-guide…pdf` | interfaccia generale: viste, trend, manovre, O₂ boost, disconnessione, alto flusso con Edi |
| `servo-air-short-guide-niv-high-flow…pdf` | modi NIV (PS, CPAP, PC), trigger automatico, fine inspirazione 10-70%, perdita > 95%, alto flusso 5-60 l/min e suoi due allarmi |

## Cosa dicono le schermate (letto dalle immagini, 21/11)

Le immagini aggiungono molto al testo: numeri reali, forme delle curve, errori tipici. Ritagli
ad alta risoluzione in `/private/tmp/claude-501/…/scratchpad/nava/` e `…/pg/` (temporanei: se
servono vanno ri-estratti dai PDF).

**La formula regge sui numeri veri.** In ogni schermata pulita
`Ppicco ≈ livello × (EAdi picco − EAdi min) + PEEP` entro 1-2 cmH₂O (1,6 × (9,6 − 0,1) + 3 =
18,2 contro 18 misurato; 1,3 × (5,5 − 0,3) + 5 = 11,8 contro 13). Quando non regge è il tetto:
EAdi picco 47 µV a livello 1,0 darebbe 52 cmH₂O, la curva è tagliata piatta a ~31 (limite 36 − 5).
→ **test numerici diretti** per il modo.

**Forma delle curve in assistenza neurale** (diversa da tutto ciò che disegniamo oggi):
- la Paw ha **la forma dell'EAdi** scalata: sale piano, cima arrotondata e irregolare, altezza
  diversa a ogni atto, poi cade di colpo appena dopo il picco dell'EAdi (ciclaggio al 70% sulla
  discesa);
- il **flusso cresce durante l'inspirazione** (non decelera come in PS), poi crolla al ciclaggio;
- l'EAdi è ancora in discesa quando la pressione è già finita; decade lento (~1 s);
- variabilità atto per atto grande: distribuzioni pubblicate di PIP e VT a destra asimmetriche
  (diapositive NICU 25-26) → priors per la variabilità del drive in questo modo.

**Numeri tipici visti** (adulto): EAdi picco 5-15 µV, min 0-2 µV; livello 0,5-2,0; Ppicco 13-23;
VT/PBW 4,5-6,5; Ti/Ttot 0,2-0,4. Distress grave in un modo convenzionale: **EAdi picco 113 µV**
contro un bersaglio di 5-15 (NICU p40). Sinderby: nel BPCO l'EAdi è ~35-40% del massimo e la
frequenza doppia del sano, nel post-polio burst larghi e a plateau.

**Titolazione (curve pubblicate):** alzando il livello da 0 a 3 l'EAdi picco scende da ~18 a
~8 µV e si appiattisce, il VT/PBW sale da ~4 a ~6,5-7 e si ferma; il ginocchio a livello 1,0-1,5.
Nei neonati: PIP sale lineare e poi si appiattisce, EAdi piatto e poi in calo (breakpoint a 1,0
e 1,5 in due pazienti). → **il test del breakpoint ha già i numeri di riferimento.**

**La stima della pressione sovrapposta è lo strumento didattico più forte**: nella schermata
del bambino in SIMV con distress la curva stimata dall'EAdi sale a ogni sforzo, anche quelli che
la macchina ignora, e da sola mostra sforzi persi, trigger ritardati e ciclaggi precoci senza
bisogno di frecce. Si usa anche per scegliere il livello iniziale («preview»).

**Errori del segnale che si vedono** (casi di regia pronti):
- catetere troppo superficiale/profondo: derivazioni evidenziate in alto o in basso, EAdi
  rumoroso con **EAdi min alto** (9-17 µV: artefatto, non attività tonica), picchi erratici che
  tagliano la scala;
- **EAdi picco ≈ EAdi min** = nessun segnale fasico (catetere perso, apnea): messaggio «verificare
  il modulo», molto tempo in backup;
- catetere che prende un **muscolo espiratorio** (troppo profondo);
- EAdi assente con ECG pulito su tutte le derivazioni (sedazione, curaro, frenico).

**Backup e fallback sullo schermo:** etichetta di modo con il backup accanto («modo ⇄ backup»);
in backup un banner e una domanda «tornare al supporto?»; le impostazioni di backup grigie
finché non servono. Due trend separati: **% del tempo in backup** e **numero di ingressi in
backup al minuto** (la diapositiva-quiz insegna a non confonderli: tanti ingressi brevi con poco
tempo in backup = drive buono).

**Allarmi dedicati:** asincronia segnale-pneumatica (con messaggio di verifica: posizione,
trigger pneumatico, trigger EAdi), «attività EAdi bassa», modulo/catetere staccato (alta
priorità se in assistenza neurale), «verificare posizione catetere», «regolazione pressione
limitata».

**Posizionamento**: quattro derivazioni ECG esofagee (±0,4-1 mV), onda P visibile in alto che
sparisce in basso, QRS che cala verso il basso; l'attività diaframmatica evidenziata **solo
durante i burst inspiratori** sulle derivazioni centrali; un indicatore verticale lungo il
catetere; campo «distanza di inserimento finale» e passaggio diretto al modo. L'evidenziazione si
sposta verso il basso durante l'inspirazione (il diaframma scende): dettaglio realistico facile.

**Monitoraggio dappertutto**: corsia EAdi con scala propria (12/20/40/80 µV o automatica; i
picchi oltre scala si tagliano), segno del trigger neurale all'inizio della salita, trend
EAdi picco/min a 1 h e oltre, anche in standby e in alto flusso.

**Alto flusso**: niente curve respiratorie; due numeri grandi (flusso, O₂), un fondo animato che
dice «sta erogando», schermata di preparazione con tre controlli (monitoraggio esterno,
interfaccia giusta, umidificatore attivo) e **riscaldamento 0-2 min**; con il catetere, l'EAdi è
l'unica curva. Due allarmi: «pressione inspiratoria alta» (alta priorità) e «flusso nel tubo
espiratorio» (media). Nessun limite da impostare.

**NIV**: niente impostazione del trigger (automatico); il **segno del trigger compare sulla
curva che lo ha causato** (sul calo di Paw se a pressione, sul flusso se a flusso, sull'EAdi se
neurale); perdita % come numero grande; volumi con asterisco quando la perdita li rende
inaffidabili; curve piene in NIV.

**Funzioni generali utili** (idee d'uso, disegno nostro):
- **scala di sicurezza** sui comandi (range normale, il resto dietro un'estensione);
- **immagini dinamiche** che mostrano l'effetto di salita e fine inspirazione mentre si gira la
  manopola, con I:E e volume minuto derivati che si aggiornano — molto didattico;
- **scala del trigger unica**: flusso a sinistra, pressione a destra, zona rossa di autotrigger;
- **finestra limiti d'allarme** con barra per parametro e freccia sul valore attuale, «autoimposta»;
- allarme che rende **pieno** il riquadro del valore e cerchia il limite superato; lista con
  checklist di cosa controllare;
- **trend brevi** accanto ai numeri (15 min) e trend lunghi con eventi sulla linea del tempo;
- vista con **bersaglio di volume e pressione** (volume erogato rispetto a 6 ml/kg, PEEP e
  driving pressure rispetto al limite totale): concetto utile, disegno da inventare;
- **reclutamento automatico a gradini** con tabella prima/dopo e curva della compliance per
  scegliere la PEEP; ossigenazione pre/post aspirazione in quattro passi; O₂ boost +30 punti.

## Regola di copyright (vale per tutto il piano)

- I **fatti fisiologici e le regole di funzionamento** (formule, soglie, tempi) si possono
  riprodurre: non sono protetti come espressione. Li riscriviamo con parole e codice nostri.
- **Non** copiamo: layout delle schermate, icone, palette (il rosa/viola della traccia),
  nomi commerciali, testi dei manuali, nomi di finestre («Neural access», «NAVA preview»,
  «Servo Compass», «Family view»…).
- **Nome del modo**: «NAVA» e «NIV NAVA» sono marchi registrati. Proposta: in interfaccia
  «Assistenza neurale» (sigla nostra, es. **NEURO** o **AN**), il segnale chiamato **EAdi** (il
  termine della letteratura, non quello del produttore che scrive «Edi»). Nei testi didattici si
  può dire «l'assistenza ventilatoria regolata dal segnale del diaframma (in letteratura NAVA)».
  **Da decidere con l'utente.**
- Nessun riferimento al Sim Scenario Creator nei file pubblici di OVS (regola già in memoria).

## Cosa c'è già in OVS (3.7, `main` a 09a17ad)

- Motore a integrazione dell'equazione del moto con Pmus del paziente (`motore.ts`), drive
  indipendente dalla macchina (`asincronie.ts`: frequenza, intensità, forma, espirio attivo,
  `responsivo` = il paziente scarica lo sforzo sul supporto), P0.1, PAV, CPAP, PS, PC, PRVC,
  SIMV, asincronie anche miste.
- NIV: solo PS e CPAP, con perdita della maschera e compensazione (`perdita`, `fluttua`).
- Alto flusso: ambiente `alto-flusso`, modalità `AF`, misura **solo** temperatura e acqua; le
  onde sono ferme (`onde.ts` → `FERMO`), nessun flusso mostrato come numero grande, nessun
  allarme specifico.
- Monitor: Paw, flusso, volume, Palv/Pes didattiche, EIT, loop; trend e registro della sessione.

## 1. Il segnale EAdi nel motore (la base di tutto)

Il drive c'è già: la Pmus è la sua conseguenza meccanica. L'EAdi è la stessa cosa **prima**
della meccanica, quindi si ricava dallo stesso sforzo, non da un generatore a parte:

- `EAdi(t) = EAdi_min + Pmus⁺(t) / NME`, dove **NME** (efficienza neuromeccanica, cmH₂O/µV) è
  una proprietà del paziente: alta nel sano, bassa nel diaframma debole o nel BPCO
  iperinsufflato. Stesso sforzo meccanico, segnale molto più grande: è il messaggio clinico dei
  documenti («nel BPCO si usa fino al 40% della capacità»). Valori da prendere dalla letteratura
  (Bellani, *Crit Care Med* 2013, rapporto Pmus/EAdi; da verificare su PubMed prima di fissarli).
- **EAdi_min** (attività tonica): sale con il dereclutamento e la PEEP bassa (lega a `peepMemoria`
  / atelettasia già nel modello); il bersaglio clinico è sotto ~3 µV nel neonato. Nell'adulto
  il documento indica solo i picchi.
- **Rumore di fondo** < 0,5 µV e **interferenza dell'ECG** (cuore = 10-100 volte più ampio):
  attiva solo con catetere mal posizionato o filtro guasto, utile come guasto di regia.
- **Curaro**: EAdi assente (la giunzione blocca il potenziale muscolare); **sedazione profonda**:
  EAdi basso o assente; **lesione del nervo frenico**: assente da un lato o del tutto.
- **Iperventilazione** (PaCO₂ bassa dal modello di scambio) → drive e EAdi giù; acidosi → su.
  Il collegamento con `scambio.ts` esiste già per altri numeri: da qui viene la regolazione
  «fisiologica» del drive.
- **Riflesso di Hering-Breuer**: a volumi alti il drive si spegne (limita la sovradistensione in
  assistenza neurale). Va nel drive `responsivo`, che oggi risponde solo alla pressione di
  supporto.

Misure nuove: `edPeak`, `edMin` per atto (in `AttoMotore`), più la frequenza neurale e il Ti/Ttot
neurale (servono alle regole di fallback, non si mostrano).

**Test**: EAdi = 0 con curaro; a parità di Pmus, NME dimezzata raddoppia l'EAdi; EAdi_min sale
quando la PEEP scende sotto la memoria di reclutamento; sedazione/ipocapnia riducono il picco.

## 2. Monitoraggio EAdi in tutti i modi (prima del modo vero e proprio)

È la parte con più valore didattico e meno rischio, e serve anche all'alto flusso e alla NIV.

- **Corsia EAdi** (µV) sotto le tre curve, accesa quando il catetere è montato (dalla regia o
  dall'allestimento). Numeri EAdi picco ed EAdi min. Colore nostro.
- **Disponibile anche in standby e in alto flusso**: il flyer insiste su «dal giorno zero», cioè
  prima dell'intubazione per predire il fallimento della NIV, e dopo l'estubazione.
- **Stima della pressione** in sovrapposizione (curva grigia sulla Paw) mentre si ventila in un
  modo convenzionale: «quanto darebbe l'assistenza neurale a questo livello». È lo strumento con
  cui si sceglie il livello iniziale. Il nome della finestra è nostro.
- **Trend atto per atto**: Ppicco, livello, EAdi picco/min, VTe, EtCO₂, P0.1 nel registro e nel
  pannello trend (c'è già l'infrastruttura del registro).
- **Lettura delle asincronie con l'EAdi**: con la corsia accesa le asincronie che già facciamo
  diventano evidenti (sforzo inefficace = picco EAdi senza atto; ciclaggio ritardato = EAdi già
  sceso mentre la macchina insuffla). È l'uso «diagnostico» citato in tutti i documenti, e lo
  otteniamo quasi gratis dal motore attuale.

## 3. Posizionamento del catetere (tour e regia)

- Calcolo della profondità con la misura **NEX** (naso-lobo-xifoide) e il fattore per via nasale
  (0,9) o orale (0,8) più una costante per calibro. È una regola anatomica pubblicata: la
  riscriviamo come calcolatore nostro.
- **Quattro derivazioni ECG** dall'esofago: onde P e QRS alte in cima, P che spariscono in basso;
  la derivazione dove l'EAdi è più forte si evidenzia. Troppo profondo → evidenziate le basse
  (e può comparire un muscolo espiratorio); troppo superficiale → le alte; si corregge a passi di
  una distanza interelettrodica, mai oltre quattro.
- Il discente sposta il catetere di centimetri; la regia sceglie l'errore iniziale (corretto,
  profondo, superficiale, dislocato dopo un'ora).
- Verifica con **occlusione di fine espirazione**: la deflessione positiva dell'EAdi coincide con
  quella negativa della Paw. Abbiamo già la pausa espiratoria: basta mostrarla affiancata.

## 4. Il modo: assistenza neurale invasiva

Regole (dalla study guide, riscritte):

- **Pressione**: `Paw = PEEP + livello × (EAdi − EAdi_min)`, istante per istante. Livello
  0-30 cmH₂O/µV (partenza tipica 0,5-1,0). Tetto: limite alto di pressione − 5 cmH₂O, oltre il
  quale suona «regolazione pressione limitata».
- **Trigger neurale**: aumento di EAdi oltre `EAdi_min + soglia` (0,5 µV di default, 0-2), in
  gara con il trigger pneumatico («chi arriva prima»). Il display segna chi ha aperto l'atto.
- **Ciclaggio**: quando l'EAdi scende sotto il 70% del picco (40% con segnali bassi), oppure
  se la Paw sale 3 cmH₂O sopra il bersaglio, oppure al limite di pressione. Ti massimo 2,5 s
  nell'adulto.
- **Backup**: senza EAdi né trigger pneumatico per il tempo d'apnea → pressione controllata di
  backup.
- **Passaggio al supporto di pressione** quando il segnale non è credibile: frequenza neurale e
  pneumatica differiscono > 25% per ≥ 5 s (su finestra di 20 s), Ti/Ttot neurale > 0,5 (catetere
  non valido) o > 0,6 (valido), catetere staccato, ECG nel segnale. **Ritorno** quando la
  differenza scende sotto il 20% e almeno 7 degli ultimi 10 atti sono sincroni. **Allarme di
  asincronia** dopo 80 s di fila nel fallback o 6 passaggi in 5 minuti.
- **Impostazioni**: livello, PEEP, FiO₂, soglia EAdi; supporto di pressione di riserva (trigger,
  fine inspirazione, PS); backup PC; tempo d'apnea.

Nel motore è un nuovo `tipoAtto` (`'neurale'`) accanto a supporto e PAV: la PAV moltiplica la
Pmus, questo moltiplica l'EAdi; cambia **chi** viene amplificato (il segnale elettrico, non la
forza), quindi con un diaframma debole l'assistenza neurale scarica di più della PAV.
La sincronia viene da sé: trigger e ciclaggio sono sullo stesso segnale dello sforzo.

**Fenomeni che devono emergere senza scriverli** (e diventano test):

- **Titolazione a breakpoint** (presentazione NICU): alzando il livello prima sale la Ppicco e
  l'EAdi resta alto, poi la Ppicco si appiattisce mentre l'EAdi scende, poi oltre si sopprime il
  drive. Con il drive `responsivo` + Hering-Breuer deve venir fuori da sola.
- **Sovra-assistenza**: EAdi picco basso, CO₂ bassa, molto tempo in backup.
  **Sotto-assistenza**: EAdi picco > 20 µV, frequenza alta.
- **Volume autolimitato** nel range protettivo (4-8 ml/kg) per il Hering-Breuer.
- Le asincronie di trigger e ciclaggio spariscono; resta il problema del segnale.

Bersagli del flowchart adulto (per i casi e per i test di plausibilità): invasiva livello iniziale
0,5, EAdi picco ~10-20 µV; NIV preventiva livello 1,0, EAdi picco ~5-15 µV; VT 4-8 ml/kg, FR
15-35; svezzamento a passi di 0,1(-0,2).

## 5. Assistenza neurale in NIV

- Stesse regole, ma **trigger e ciclaggio indipendenti dalla perdita**: è il punto didattico
  rispetto alla NIV PS con maschera che perde (che già simuliamo con autotrigger e ciclaggio
  ritardato da perdita). Caso pronto: BPCO riacutizzata, maschera con perdita del 30%, prima in
  PS (asincronie da perdita) poi con assistenza neurale.
- Livello 0 = CPAP con monitoraggio EAdi e backup sull'apnea (uso neonatale citato: utile anche
  come idea per l'adulto in svezzamento).

## 6. Migliorie alla NIV convenzionale

Dalla guida NIV/alto flusso, in ordine di valore:

1. **NIV PC** (pressione controllata a tempo, con atti assistiti): oggi in NIV ci sono solo PS
   e CPAP.
2. **Trigger automatico** in NIV (compensato sulla perdita) con indicazione di come è partito
   l'atto (flusso o pressione).
3. **Fine inspirazione 10-70%** (oggi 5-70) e salita: già presenti, verificare i limiti.
4. **Perdita > 95%**: comportamento configurabile (continua / pausa con flusso fisso alto / basso)
   con allarme di perdita eccessiva: scenario «maschera staccata».
5. **Partenza in attesa**: la ventilazione parte quando il ventilatore vede attività del paziente.
6. Percentuale di perdita già c'è: controllarne la presentazione.

## 7. Grafica e funzioni dell'alto flusso

Oggi l'alto flusso è il punto più povero. Proposta, con disegno nostro:

- **Numeri grandi**: flusso erogato (l/min), FiO₂, temperatura erogata; acqua della camera.
- **Schermata di preparazione**: interfaccia giusta (cannula nasale/tracheostomia), umidificatore
  attivo, conto alla rovescia del riscaldamento, «avvia» (il flusso parte da 0 e sale al valore).
- **Range**: adulto 5-60 l/min, pediatrico 2-30.
- **Due allarmi realistici**: pressione inspiratoria alta (occlusione della cannula o del tubo)
  e flusso nel ramo espiratorio (circuito montato sulla porta sbagliata): errori di montaggio da
  regia.
- **Corsia EAdi** se il catetere c'è (sezione 2): l'unica curva vera in alto flusso, e il modo
  per vedere lo sforzo che cresce prima dell'intubazione.
- **Fisiologia minima da aggiungere** (da verificare in letteratura prima): PEEP espiratoria
  modesta che cresce con il flusso a bocca chiusa, lavaggio dello spazio morto (lega a
  `scambio.ts`: VD anatomico che scende), indice **ROX** (SpO₂/FiO₂/FR) calcolato e mostrato
  in regia come riferimento per il docente, non sul device.
- Passaggio diretto da invasiva/NIV ad alto flusso (dopo l'estubazione) e viceversa.

## 8. Altre funzioni viste nei documenti (candidate, priorità bassa)

- **O₂ boost** a tempo (1 minuto, livello configurabile) se non c'è già nella stessa forma.
- **Supporto alla disconnessione** per l'aspirazione (niente cicli né allarmi): importante in
  assistenza neurale, dove altrimenti scatta l'allarme di asincronia.
- **Registrazione di 30 s** (15 prima e 15 dopo) e istantanee: abbiamo il registro, manca il
  pezzo di curva salvato.
- **Viste**: una vista «a distanza» con pochi numeri grandi e una vista per i familiari sono idee
  d'uso, non da copiare nel disegno.
- **Respiro manuale**, **nebulizzazione a tempo**, **heliox** (la densità del gas cambia la
  resistenza turbolenta: già abbiamo il termine di Rohrer, sarebbe un caso interessante).
- Categoria **neonatale**: fuori portata ora (cambia tutto, da volumi a circuiti).

## Ordine proposto per la prossima sessione

1. **Decidere** con l'utente il nome del modo e del segnale, e se la regia deve poter montare il
   catetere su qualunque paziente (anche in alto flusso e in standby).
2. **EAdi nel motore** (sez. 1) con test di fisiologia, **senza** ancora il modo. Letteratura per
   NME, EAdi normali e patologici (PubMed).
3. **Corsia EAdi + numeri + stima della pressione + asincronie lette con l'EAdi** (sez. 2).
   Primo PR: già utile in aula con tutti i modi esistenti. Caso pronto subito possibile: il
   paziente in SIMV con distress (EAdi > 100 µV, sforzi persi, trigger tardivi, ciclaggi
   precoci) dove la stima della pressione rivela tutto.
4. **Modo assistenza neurale invasiva** (sez. 4) con backup, fallback al supporto e allarmi.
   Test numerici con i valori delle schermate: formula entro 1-2 cmH₂O, tetto a limite − 5,
   curva di titolazione con il ginocchio a livello 1,0-1,5 (EAdi da ~18 a ~8 µV, VT da ~4 a
   ~6,5-7 ml/kg), flusso inspiratorio crescente e Paw a forma di EAdi.
5. **NIV**: assistenza neurale non invasiva + NIV PC + perdita > 95% (sez. 5-6).
6. **Alto flusso** (sez. 7).
7. **Catetere** (sez. 3) e tour.
8. Casi pronti nuovi: titolazione del livello, BPCO in NIV con perdita, svezzamento difficile
   con EAdi alto, sovra-sedazione con EAdi basso, catetere dislocato.
9. Ogni passo: allineare il ventilatore dello Scenario Creator e la sua regia (come per la 3.7),
   e niente release senza il via dell'utente.

## Domande aperte per l'utente

- Nome del modo e del segnale in interfaccia (vedi copyright).
- Priorità tra assistenza neurale, alto flusso e NIV PC, se il tempo non basta per tutto.
- Il catetere va «inserito» dal discente (passi e posizionamento) o lo monta la regia?
- Serve la categoria pediatrica/neonatale nei prossimi mesi? Cambia i range di tutto.
