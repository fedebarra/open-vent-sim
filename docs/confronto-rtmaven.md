# Open Vent Sim e il simulatore di Piraino (sim.rtmaven.com)

Confronto fatto l'8 novembre 2026 sulla versione pubblica di sim.rtmaven.com
(Thomas Piraino RRT, revisione esterna di Giacomo Bellani), usata come
riferimento per la meccanica respiratoria. Valori misurati con Playwright, a
macchina e paziente regolati come in `tests/riferimento-rtmaven.test.ts`.

Il codice di RTMaven non ha una licenza aperta: è stato letto per capirne il
comportamento, **niente è stato copiato**. Il motore di Open Vent Sim è scritto
da capo, e su un punto (la limitazione al flusso) usa un modello diverso.

## Dove RTMaven è più forte

1. **È un motore, non un disegno.** Ogni curva esce dall'equazione del moto con
   la Pmus dentro: l'auto-PEEP si accumula da un atto all'altro, lo sforzo
   inefficace è uno sforzo vero che non passa il trigger, il doppio trigger è
   uno sforzo più lungo del Ti della macchina. Le asincronie non si dipingono:
   succedono.
2. **Pmus fisiologica**: salita, tenuta e discesa separate (con la discesa che
   sconfina nell'espirazione), Pmus «responsiva» al supporto, P0.1 misurata.
3. **Monitoraggio avanzato**: Pes e PL (Pes,ee/ei, PL,ee/ei, test di
   occlusione), pause inspiratoria ed espiratoria che misurano davvero, stress
   index, airway opening pressure, volume reclutato per il rapporto R/I.
4. **EIT**: immagine dinamica e tidal, ROI, pendelluft (Cornejo/Arellano),
   analisi di reclutabilità, PEEP trial con incrocio overdistension/collapse
   tarato su RECRUIT (Jonkman 2023).
5. **Didattica**: preset di asincronie e di pressione esofagea, link per i
   discenti senza account, sessioni d'insegnamento, scenari esportabili in Excel.
6. **Modalità**: PAV+, assistita-controllata vera in VC/PC/PRVC.

## Dove RTMaven è più debole (e noi no)

- **Molte costanti ad hoc** dentro le formule (fattori di trasmissione 0,75,
  moltiplicatori ×2,5 sul recoil, filtri passa-basso sul flusso per nascondere
  discontinuità): funziona a occhio, ma non è fisica. Il loro stesso manuale
  ammette artefatti sul flusso su Safari.
- **Motore a tick**, legato alla frequenza dei fotogrammi: si ferma se la
  scheda non è in primo piano, e due schermi non disegnano mai la stessa cosa.
  Il nostro è una funzione pura del tempo (blocchi deterministici), ed è quello
  che serve all'aula in rete.
- **La limitazione al flusso cambia poco**: col preset «moderate» il picco e la
  PEEP misurata sono quasi quelli del polmone senza limitazione. Il nostro usa
  un resistore di Starling (pressione critica, la PEEP che la sostituisce
  invece di sommarsi: la regola dell'80%), e l'auto-PEEP si vede.
- **Solo polmone**: niente circolo, gas, allarmi, anestesia, alto flusso, NIV
  con perdite, regia multi-dispositivo, registro di sessione. Su questo Open
  Vent Sim e lo scenario creator sono un'altra categoria.
- **Account e server** per salvare e insegnare; noi stiamo su LAN, gratis.

## Che cosa è entrato nella 3.2

| | Prima (3.1) | Ora |
|---|---|---|
| Curve | disegnate; PC = tracciato registrato riscalato | `motore.ts`: equazione del moto integrata a 200 Hz, deterministica |
| Auto-PEEP | formula esponenziale per atto | si accumula da sé; resistore di Starling per l'ostruito |
| Asincronie della regia | figure sovrapposte | **cause**: sforzi muti, sforzi lunghi, entrainment, espirio attivo, trigger spurio |
| Trigger | 100 ms disegnati | ritardo di 50 ms, soglia sul flusso vero, refrattario; circuito chiuso in controllata |
| Ciclaggio PS | Ti = −RC·ln(soglia) | flusso < soglia × picco, o pressione, o Ti massimo |
| Modalità | — | **PAV+** (supporto 5-95%) |
| Assistita-controllata | no (§325) | interruttore **A/C** in VC/PC/PRVC (spento di default) |
| Pressioni | Palv, Pmus | + **Pes e PL** (pulsante «Pes·PL»), artefatto cardiaco |
| Oscillazioni cardiache | — | `fisiologia.oscillazioniCardiache`: auto-trigger col trigger sensibile |
| Pause | numeri analitici | ferme sull'ultimo atto vero (plateau statico, PEEP totale) |
| Numeri in PS/CPAP/PAV/A-C | analitici | contati sugli atti erogati |

Scostamento dal riferimento (VT): PC 1%, PC Ti corto 2%, PS 10 1%, PS 5 1%,
PAV+ 2%, VC picco e plateau entro 0,5 cmH₂O. La CPAP pura è il 16% sotto
(224 contro 267 ml), ma il numero di RTMaven in CPAP non torna con il suo
stesso flusso: vedi «Che cosa resta diverso», punto 1.

## Il secondo giro (sempre 3.2)

| Voce della lista | Com'è entrata |
|---|---|
| Regia: oscillazioni cardiache, forma della Pmus, Pes basale, preset | Scheda **Sforzo e parete** in OVS, sezione omonima nello scenario creator; otto quadri (`quadri.ts`) che si sommano al polmone e si tolgono uno per uno |
| Pmus responsiva, P0.1, Pocc | `drive.responsivo` (−0,6 cmH₂O di Pmus per cmH₂O di PS, fondo 35%); **P0.1** sul display; la pausa espiratoria con uno sforzo dentro dà ΔPocc, Pmus stimata (0,75·|ΔPocc|), ΔPL dinamica (Bertoni 2019), ΔPaw/ΔPes |
| Stress index, AOP, volume reclutato, R/I | Curva P-V non lineare (`E1·V + E2·V²`, corda invariata): lo stress index **esce dalla curva**, non si scrive. `aperturaVie` chiude le vie aeree; manovra **curva P/V lenta** (5 l/min) che trova il ginocchio; manovra **rapporto R/I** (Chen 2020) |
| Variabilità naturale | `drive.variabilita`: ampiezza, durata e istante, gaussiana seminata per atto (deterministica) |
| Flusso decelerante | `formaFlusso`: rampa dal doppio a zero; RTMaven 17,5 cmH₂O, noi 17,7 |
| EIT e PEEP trial | `eit.ts`: polmone a 8 fette ventro-dorsali col gradiente della pressione sovrapposta; immagine 32×32, curve regionali, pendelluft (Yoshida 2013), trial di Costa con incrocio |
| Esportazione scenari, link discenti | Scenario JSON dalla regia (salva/carica, valori controllati); i link per i discenti c'erano già (PIN e QR in LAN) |
| PRVC dagli atti | Il regolatore legge la media degli ultimi atti del motore: lo sforzo del paziente fa scendere la pressione |
| Altro | Freno espiratorio (`sforzoEspiratorio`, il grugnito) ed **espirio attivo** (`drive.espirioAttivo`, Pmus negativa) nel motore |

La salita dello sforzo è cambiata (da gradino liscio a `1 − (1 − u)^1,7`, proporzioni 50/5/40): la P0.1 viene 2,5 contro i 2,3 di RTMaven, e i volumi di PS e PAV+ restano entro il 2,5%.

## Che cosa resta diverso

1. **CPAP pura: è il riferimento a non tornare.** Il nostro corrente è 225 ml, quello di RTMaven 267-277. Misurando le loro curve atto per atto (9 novembre 2026) l'integrale del **loro** flusso in CPAP fa 177 ml, mentre la loro curva del volume e il VT dicono 278: in CPAP il loro volume è più alto di un 57% rispetto al flusso che disegnano. In PS 5 i due conti combaciano (383 contro 382), ed è lì che noi combaciamo con loro. A parità di sforzo, la fisica dei due motori dà lo stesso flusso alla stessa pressione; il nostro VT è l'integrale del nostro flusso per costruzione. Il numero di riferimento in CPAP non si usa più come bersaglio.
2. **L'EIT non ha isteresi**: la discesa e la salita di PEEP danno la stessa curva. Il trial vero si fa dopo un reclutamento, scendendo, e lì il polmone resta più aperto. La taratura è ragionevole (ARDS reclutabile: incrocio 16-17 cmH₂O, 66% di ventilazione ventrale a PEEP 5) ma non è quella di RECRUIT.
3. **I cambi di impostazione non hanno transitorio**: il motore è una funzione pura del tempo e ricalcola la storia con le impostazioni nuove. Scendendo di PEEP non si vede il grande espirio: il rapporto R/I lo calcola e lo disegna come manovra. È il prezzo del determinismo che serve all'aula in rete.
4. Lo stress index e la chiusura delle vie aeree sono sul modello a un compartimento: la curvatura è tarata (reclutamento tidalico sotto PEEP 10 se c'è polmone da riaprire, sovradistensione sopra un plateau di 25), non misurata su pazienti.
