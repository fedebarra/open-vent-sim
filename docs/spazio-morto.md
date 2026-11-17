# CO₂ e spazio morto (3.6)

Riferimento: Cipulli F, Sanna A, Garberi R, Lassola S, Forcione M, Bellani G, Foti G, Rezoagli E. *Dead space in critical care: a practical approach with clinical scenarios.* J Anesth Analg Crit Care 2026;6:20. doi:[10.1186/s44158-025-00320-4](https://doi.org/10.1186/s44158-025-00320-4).

Il modello dello scambio (`device/screens/scenario/ventilatore/scambio.ts`) è allineato al lavoro dove il lavoro dà qualcosa di misurabile. Le prove sono in `tests/spazio-morto-36.test.ts`.

## Cosa è cambiato

| | Prima (3.5) | Adesso (3.6) | Dal lavoro |
|---|---|---|---|
| PaCO₂ e PACO₂ | lo stesso numero: lo shunt non toccava la CO₂ | PaCO₂ = PACO₂ + Qs·(PvCO₂ − PACO₂); lo scambio tessuti-polmone va con (1 − Qs) | lo shunt alza la PaCO₂ e abbassa la PACO₂: l'Enghoff sovrastima lo spazio morto, molto sopra il 40% |
| Gradiente PaCO₂ − EtCO₂ a riposo | circa 1 mmHg (spazio morto alveolare di base 0,03) | circa 4–5 mmHg (0,10) | circa 5 mmHg |
| EtCO₂ sopra la PaCO₂ | impossibile | possibile con l'auto-PEEP: quota di fine espirazione dagli alveoli intrappolati = (PEEPi − 2)/14, fino a 0,85, alla PvCO₂ | asma grave: CO₂ intrappolata, spazio morto negativo |
| Capnogramma | sempre con plateau | senza plateau (pinna di squalo) con resistenza, limitazione al flusso o auto-PEEP | plateau di fase 3 assente nell'ostruzione |
| VCO₂ di base | 0,8 × 3,5 = 2,8 ml/kg/min | 3 ml/kg/min (QR 0,86, anche nell'equazione dei gas alveolari) | 3–4 ml/kg/min |
| Depositi rapidi di CO₂ | sangue 0,15, tessuti 0,75 ml/mmHg/kg | stesso totale (0,9), ripartito 2,5 : 8,5 | 120 l: 89% osso (lento, giorni: non modellato), 11% rapido (interstizio 8,5%, sangue 2,5%) |
| Indici | VD/VT fisiologico con la PACO₂ vera | Bohr-Enghoff con la PaCO₂: alveolare (PaCO₂ − EtCO₂)/PaCO₂, fisiologico (PaCO₂ − PECO₂)/PaCO₂, anatomico per differenza; EtCO₂/PaCO₂; VR = VE·PaCO₂/(100·kg·37,5); VE standardizzata = VE·PaCO₂/40 | le stesse formule |
| Spazio morto delle vie aeree | fisso: 1,1 ml/kg intubato, più il circuito | cresce con la PEEP: 0,045 ml/kg per cmH₂O sopra PEEP 5 (3 ml per cmH₂O a 70 kg), uguale a PEEP 5 | Fowler lineare col volume polmonare (Johns, Appl Physiol Nutr Metab 2006, doi:10.1139/h06-019); in un ARDS sperimentale dal 32% al 53% del VT fra PEEP 0 e 30 (Tusman, Respir Care 2019, doi:10.4187/respcare.06843) |
| Sovradistensione | dimezza la compliance a PEEP 27, per tutti | PEEP di sovradistensione del paziente, di base 27 | — |

In regia, scheda *Scambio dei gas*, c'è il riquadro «CO₂ e spazio morto» con questi indici, e tre avvisi: EtCO₂ sopra la PaCO₂ (calcolo non affidabile), shunt sopra il 40% (sovrastima, il trend tiene), EtCO₂/PaCO₂ sotto 0,8.

La sovrastima che ne esce (spazio morto vero 0,30, vasocostrizione spenta): shunt 0,1 → +0,015; 0,2 → +0,033; 0,3 → +0,054; 0,4 → +0,081; 0,5 → +0,115; 0,6 → +0,159.

## I casi del lavoro

Paziente di 70 kg (il lavoro non dà il peso), intubato, volume controllato. Il modello riceve l'EtCO₂ del lavoro come bersaglio (ne ricava la VCO₂), uno shunt fisso e uno spazio morto alveolare vero scelti perché Qs/Qt e VD/VT di Enghoff siano quelli del lavoro; la PaCO₂ è quella che ne esce.

| Caso | Impostazioni | Lavoro | OVS | Esito |
|---|---|---|---|---|
| 1, ARDS H1N1 | VT 480, FR 24, PEEP 12, FiO₂ 0,65; shunt fisso 0,35, spazio morto 0,47, EtCO₂ 24 | PaCO₂ 48, Qs 0,27, VD 0,50, P/F 146 | PaCO₂ 48,7, Qs 0,27, VD 0,50 (vero 0,47), P/F 129 | sì (P/F −12%) |
| 1, reclutamento | ventilatore intero, ARDS reclutabile 0,45, C 46; 40 cmH₂O, poi PEEP 12 → 14 | P/F 146 → 161, Crs 48 → 53, PaCO₂/EtCO₂/VD invariati | P/F 131 → 142, Crs 55 → 55, PaCO₂ 48,2 → 48,1, VD 0,498 → 0,496 | sì per la CO₂ e lo spazio morto; la compliance non sale |
| 1, prono 16 h | regia: spazio morto 0,47 → 0,38 ed EtCO₂ 24 → 32 | PaCO₂ 56, EtCO₂ 32, VD 0,42 | PaCO₂ 55,6, EtCO₂ 32, VD 0,425 | sì, con la VCO₂ +33% |
| 2, ARDS pneumococcica | VT 380, FR 28, PEEP 14, FiO₂ 1; shunt fisso 0,53, spazio morto 0,52, EtCO₂ 25 | PaCO₂ 57, Qs 0,42, VD 0,56 | PaCO₂ 58,4, Qs 0,42, VD 0,56 (vero 0,52) | sì; PaO₂ 66 invece di 95 |
| 3, asma grave | VT 650, FR 8, PEEPi 14, FiO₂ 0,35; shunt fisso 0,13, spazio morto 0,11, EtCO₂ 63 | PaCO₂ 57, Qs 0,11, VD −0,10 | PaCO₂ 57,2, Qs 0,11, VD −0,10 | sì nel modello dello scambio; non sul ventilatore intero |
| 4, COVID, discesa di PEEP | ventilatore intero, COVID C 48, reclutabilità 0,5, margine di dereclutamento 2, PEEP di sovradistensione 20; VT 480, FR 18, FiO₂ 0,55; PEEP 18 → 10 a passi di 2 ogni 10 min; shunt fisso 0,20, spazio morto 0,25, EtCO₂ 33 | Pplat 30 → 18, Crs 40 → 69 (ΔP 7 con PEEPi 1), P/F 245 → 164, Qs 0,15 → 0,18, PaCO₂ 46 → 43, EtCO₂ 33 → 31, VD 0,28 → 0,28 | Pplat 30 → 18,1, Crs 40 → 59 (ΔP 8,1, PEEPi 0), P/F 233 → 186, Qs 0,15 → 0,19, PaCO₂ 45,9 → 42,8, EtCO₂ 33,1 → 31, VD 0,28 → 0,28 | sì, il P/F a PEEP 10 resta più alto (+13%); V/Q regionale no |

Note:

- **Prono.** OVS non ha la posizione prona. A volume minuto e VCO₂ costanti, togliere spazio morto alveolare lascia l'EtCO₂ dov'è e abbassa la PaCO₂ (a regime EtCO₂ = 863·VCO₂/VA). I numeri del lavoro, con PaCO₂ ed EtCO₂ che salgono insieme di 8 mmHg, chiedono anche una VCO₂ più alta di un terzo, che in OVS si ottiene scrivendo l'EtCO₂ 32.
- **Reclutamento.** In OVS la manovra dura 60 s, non 20 s. Il P/F sale dell'8% (+10% nel lavoro); la compliance misurata non sale, perché la meccanica non le dà il guadagno del reclutamento a PEEP 14.
- **Asma sul ventilatore.** La meccanica di OVS calcola l'auto-PEEP con la sola costante di tempo R·C, senza la limitazione al flusso: a FR 8 e VT 650 arriva a 1–2 cmH₂O anche con resistenza 40 e limitazione 0,9, non a 14. Senza auto-PEEP la CO₂ intrappolata non c'è e l'EtCO₂ resta sotto la PaCO₂. Il caso 3 si ripete nello scambio dei gas, con l'auto-PEEP data, e non dal ventilatore.
- **Caso 4.** Il modello EIT di OVS (`eit.ts`) ha otto fette di ventilazione e il PEEP trial decrementale (collasso contro sovradistensione), quindi la parte «PEEP ottimale con la discesa» si fa; non ha la perfusione regionale, né il bolo salino né la mappa V/Q. La perfusione del modello dello scambio sta in quattro compartimenti globali, non in regioni. Le percentuali del caso (V/Q appaiati, ventilazione non appaiata, perfusione dipendente/non dipendente) non hanno un corrispondente.
- **Margine di dereclutamento (regia, scheda *Polmone*).** Di quanto la PEEP può scendere sotto quella a cui il polmone è stato reclutato prima che cominci a dereclutarsi. Di base 8 cmH₂O, come prima della 3.6. Abbassarlo conta solo con la reclutabilità da 0,4 in su: con 0,2 a PEEP 10 tutte le fette restano aperte qualunque sia il margine. Il valore 2, e la PEEP di sovradistensione 20, sono tarati sul caso 4, non preso dalla letteratura. Il preset riapplicato lo riporta a 8.
- **Caso 4, la CO₂.** La VE è la stessa alle due PEEP (8,6 l/min) e lo spazio morto alveolare resta 0,28, eppure PaCO₂ ed EtCO₂ scendono insieme del 6–7%: la ventilazione alveolare totale è salita, cioè lo spazio morto delle vie aeree è sceso. Con 3 ml per cmH₂O, 8 cmH₂O in meno sono 24 ml per atto.
- **PEEP di sovradistensione (regia, scheda *Polmone*).** Abbassarla fa calare la compliance prima salendo di PEEP e la fa risalire di più scendendo. Riguarda la meccanica del ventilatore, non le fette dell'EIT. Il preset riapplicato la riporta a 27.
- **Rapporto ventilatorio.** Usa il peso del paziente: OVS non ha l'altezza, quindi niente peso ideale.

## Nella regia

- **Casi dalla letteratura** (scheda *Paziente*, `remote/scenari.ts`): i casi 1, 2 e 4 come scenari pronti, ARDS da influenza H1N1, ARDS pneumococcica e COVID-19 con PEEP decrementale. Ognuno porta la nota per il docente e il riferimento al lavoro e al caso; le prove sono in `tests/scenari-pronti.test.ts`. Il caso 3 (asma grave) non c'è: sul ventilatore l'auto-PEEP non arriva a 14 cmH₂O e il caso mostrerebbe il contrario del lavoro.
- **Polmone**: i comportamenti *Non reclutabile*, *Reclutabile*, *Instabile* impostano insieme reclutabilità (0; 0,5; 0,5), margine prima del dereclutamento (8; 8; 2) e PEEP di sovradistensione (27; 27; 20).
- **Scambio dei gas**: quadri che impostano pochi parametri e, spenti, li rimettono ai valori di base: embolia polmonare (spazio morto 0,40), consolidamento (shunt 0,25), anemia (Hb 7), febbre (39,5 °C, metabolismo ×1,3), sepsi (metabolismo ×1,5, HCO₃⁻ 18, vasocostrizione ipossica dimezzata), acidosi metabolica (HCO₃⁻ 14), CO (COHb 25%), metemoglobinemia (MetHb 20%), NO inalatorio (20 ppm). La diffusione ridotta non è un quadro: su un paziente ventilato a riposo non cambia niente.
