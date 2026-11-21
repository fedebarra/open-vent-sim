/**
 * Ready-made scenarios: clinical cases from the literature, loaded from the
 * console like a saved scenario file. Each one carries its reference (the paper
 * and the case) and what the model is expected to show, so the director knows
 * what the learner should find.
 *
 * The values are tuned on the whole ventilator (tests/spazio-morto-36.test.ts):
 * the paper gives settings, blood gas and capnography, the scenario adds the
 * fixed shunt and the alveolar dead space that make Qs/Qt and VD/VT come out as
 * in the paper. Weight 70 kg (the paper does not give it): the learner enters it.
 */
import { PRESET_FISIOLOGIA } from '../device/screens/scenario/ventilatore/fisica';
import { catetereA, catetereMontato } from '../device/screens/scenario/ventilatore/catetere';
import type { ScenarioFile } from './scenario';

export interface ScenarioPronto {
  id: string;
  nome: { it: string; en: string };
  /** What to look for, one or two sentences. */
  nota: { it: string; en: string };
  riferimento: string;
  /** The clinical picture it starts from: the console highlights it. */
  preset: keyof typeof PRESET_FISIOLOGIA;
  scenario: ScenarioFile;
}

const CIPULLI_2026 = 'Cipulli F, Sanna A, Garberi R, Lassola S, Forcione M, Bellani G, Foti G, Rezoagli E. Dead space in critical care: a practical approach with clinical scenarios. J Anesth Analg Crit Care 2026;6:20. doi:10.1186/s44158-025-00320-4';

const DE_HARO_2019 = 'de Haro C, Ochagavia A, López-Aguilar J, Fernandez-Gonzalo S, Navarra-Ventura G, Magrans R, Montanyà J, Blanch L; ASYNICU Group. Patient-ventilator asynchronies during mechanical ventilation: current knowledge and research priorities. Intensive Care Med Exp 2019;7(Suppl 1):43. doi:10.1186/s40635-019-0234-5';

const paralizzato = { frequenza: 0, intensita: 0, forma: null };

// 3.8: neural assist, NIV, high flow, the catheter.
const BRANDER_2009 = 'Brander L, Leong-Poi H, Beck J, Brunet F, Hutchison SJ, Slutsky AS, Sinderby C. Titration and implementation of neurally adjusted ventilatory assist in critically ill patients. Chest 2009;135:695-703. doi:10.1378/chest.08-1747';
const BERTRAND_2013 = 'Bertrand PM, Futier E, Coisel Y, Matecki S, Jaber S, Constantin JM. Neurally adjusted ventilatory assist vs pressure support ventilation for noninvasive ventilation during acute respiratory failure: a crossover physiologic study. Chest 2013;143:30-36. doi:10.1378/chest.12-0424';
const ROCA_2019 = 'Roca O, Caralt B, Messika J, et al. An index combining respiratory rate and oxygenation to predict outcome of nasal high-flow therapy. Am J Respir Crit Care Med 2019;199:1368-1376. doi:10.1164/rccm.201803-0589OC';
const BARWING_2009 = 'Barwing J, Ambold M, Linden N, Quintel M, Moerer O. Evaluation of the catheter positioning for neurally adjusted ventilatory assist. Intensive Care Med 2009;35:1809-1814. doi:10.1007/s00134-009-1587-0';
const DOORDUIN_2018 = 'Doorduin J, Roesthuis LH, Jansen D, van der Hoeven JG, van Hees HWH, Heunks LMA. Respiratory muscle effort during expiration in successful and failed weaning from mechanical ventilation. Anesthesiology 2018;129:490-501. doi:10.1097/ALN.0000000000002256';

/** The catheter where it should be, on a 70 kg patient. */
const catetereGiusto = catetereMontato('giusto', {}, 70);
/** The NEX rule puts it here; this patient's diaphragm sits 2.5 cm lower (Barwing 2009: median 2 cm). */
const NEX_CASO = { nexCm: 50, scartoAnatomicoCm: 2.5 };
const catetereAllaRegola = catetereA(50 * 0.9 + 18, NEX_CASO, 70);

function scenario(
  name: string,
  impostazioni: Record<string, number>,
  preset: keyof typeof PRESET_FISIOLOGIA,
  fisiologia: Record<string, number>,
  etco2: number,
  scambio: ScenarioFile['scambio'],
): ScenarioFile {
  return {
    app: 'open-vent-sim',
    kind: 'scenario',
    version: 1,
    name,
    ambiente: 'invasiva',
    modalita: 'VC',
    impostazioni,
    fisiologia: { ...PRESET_FISIOLOGIA[preset].fisiologia, ...fisiologia },
    drive: paralizzato,
    asincronia: null,
    vitali: { spo2: null, etco2, heartRate: 90, map: 80 },
    scambio,
  };
}

export const SCENARI_PRONTI: ScenarioPronto[] = [
  {
    id: 'ards-h1n1',
    nome: { it: 'ARDS da influenza H1N1', en: 'H1N1 influenza ARDS' },
    nota: {
      it: 'PaCO₂ 48 con EtCO₂ 24: spazio morto alveolare 0,50, shunt 0,27, P/F intorno a 140. Un reclutamento e la PEEP a 14 alzano poco il P/F e non toccano CO₂ e spazio morto.',
      en: 'PaCO₂ 48 with EtCO₂ 24: alveolar dead space 0.50, shunt 0.27, P/F around 140. A recruitment and PEEP 14 raise P/F a little and leave CO₂ and dead space unchanged.',
    },
    riferimento: `${CIPULLI_2026}, caso 1.`,
    preset: 'ards',
    scenario: scenario('ARDS H1N1', { volume: 480, frequency: 24, peep: 12, fio2: 65 }, 'ards', { compliance: 46, reclutabilita: 0.45 }, 24, { shuntFisso: 0.32, spazioMortoAlv: 0.47 }),
  },
  {
    id: 'ards-pneumococco',
    nome: { it: 'ARDS pneumococcica', en: 'Pneumococcal ARDS' },
    nota: {
      it: 'Shunt 0,42: lo spazio morto di Enghoff (0,56) sovrastima quello vero. Il trend tiene, il valore assoluto no.',
      en: 'Shunt 0.42: the Enghoff dead space (0.56) overestimates the true one. The trend holds, the absolute value does not.',
    },
    riferimento: `${CIPULLI_2026}, caso 2.`,
    preset: 'ards',
    scenario: scenario('ARDS pneumococcica', { volume: 380, frequency: 28, peep: 14, fio2: 100 }, 'ards', { compliance: 38 }, 25, { shuntFisso: 0.5, spazioMortoAlv: 0.52 }),
  },
  {
    id: 'covid-peep',
    nome: { it: 'COVID-19, PEEP decrementale', en: 'COVID-19, decremental PEEP' },
    nota: {
      it: 'A PEEP 18 il polmone è sovradisteso (Crs 40). Scendendo a 10 a passi di 2 la compliance risale, lo shunt sale e il P/F cala; PaCO₂ ed EtCO₂ scendono di 2–3 mmHg, lo spazio morto alveolare resta 0,28.',
      en: 'At PEEP 18 the lung is overdistended (Crs 40). Stepping down to 10 by 2 compliance improves, shunt rises and P/F falls; PaCO₂ and EtCO₂ drop by 2–3 mmHg, alveolar dead space stays 0.28.',
    },
    riferimento: `${CIPULLI_2026}, caso 4.`,
    preset: 'covid',
    scenario: scenario('COVID-19 PEEP decrementale', { volume: 480, frequency: 18, peep: 18, fio2: 55 }, 'covid', { compliance: 48, reclutabilita: 0.5, isteresi: 2, sovradistensione: 20 }, 33, { shuntFisso: 0.2, spazioMortoAlv: 0.25 }),
  },  {
    id: 'pc-fame-aria',
    nome: { it: 'PC con Ti lungo e fame d\'aria', en: 'PC with long Ti and air hunger' },
    nota: {
      it: 'PC 14 sopra PEEP 5, Ti 1,5 s (I:E 1:1), salita 0. Il paziente ha uno sforzo corto e forte e spinge per uscire: FR 23 su 20, VT oltre 10 ml/kg, punta di Paw a fine inspirazione e flusso che si inverte prima del ciclaggio su metà degli atti, doppio ciclo con il volume che si somma su un quarto. Peso ideale 58 kg. Si corregge accorciando il Ti o passando in PS.',
      en: 'PC 14 above PEEP 5, Ti 1.5 s (I:E 1:1), rise 0. The patient makes a short, strong effort and pushes to get out: RR 23 over 20, VT above 10 ml/kg, Paw spike at end-inspiration and flow reversing before cycling on half of the breaths, double cycling with stacked volume on a quarter. Ideal body weight 58 kg. Fix it by shortening Ti or moving to PS.',
    },
    riferimento: `${DE_HARO_2019}, fig. 1.`,
    preset: 'normale',
    scenario: {
      app: 'open-vent-sim',
      kind: 'scenario',
      version: 1,
      name: "PC con fame d'aria",
      ambiente: 'invasiva',
      modalita: 'PC',
      impostazioni: { pressureTarget: 14, peep: 5, frequency: 20, ratio: '1:1', inspiratoryRiseTimeSeconds: 0, triggerFlow: 2, triggerControllata: 1, fio2: 30 },
      fisiologia: { ...PRESET_FISIOLOGIA.normale.fisiologia, compliance: 40, resistenza: 10 },
      drive: { frequenza: 23, intensita: 0.9, forma: { salita: 0.35, tenuta: 0.05, discesa: 0.3 }, espirioAttivo: 0.8 },
      asincronia: { tipo: 'ciclaggio-ritardato', quota: 0.5, insieme: [{ tipo: 'doppio-ciclo', quota: 0.25 }] },
      vitali: { spo2: 95, etco2: 34, heartRate: 105, map: 85 },
    },
  },
  {
    id: 'neuro-titolazione',
    nome: { it: 'NEURO: titolare il livello', en: 'NEURO: titrating the level' },
    nota: {
      it: 'Catetere a posto, livello 0,3: EAdi intorno a 10 µV e VT basso. Alzando il livello a passi di 0,2–0,3 la Paw e il VT salgono mentre l’EAdi scende: è il paziente che scarica sulla macchina. Il livello adeguato è dove la salita di Paw e VT rallenta: oltre il ginocchio il volume si ferma intorno a 6,5 ml/kg (il riflesso di Hering-Breuer spegne l’inspirazione) mentre l’EAdi continua a calare. Riferimento: VT intorno a 6 ml/kg di peso ideale.',
      en: 'Catheter in place, level 0.3: EAdi around 10 µV and low VT. Raising the level by 0.2–0.3 Paw and VT rise while EAdi falls: the patient unloads onto the machine. The adequate level is where the rise in Paw and VT slows down: past the knee volume stops around 6.5 ml/kg (the Hering-Breuer reflex switches inspiration off) while EAdi keeps falling. Target: VT around 6 ml/kg ideal body weight.',
    },
    riferimento: BRANDER_2009,
    preset: 'polmonite',
    scenario: {
      app: 'open-vent-sim', kind: 'scenario', version: 1, name: 'NEURO: titolazione',
      ambiente: 'invasiva', modalita: 'NEURO',
      impostazioni: { livelloNeuro: 0.3, triggerEAdi: 0.5, peep: 8, fio2: 50, psLevel: 10, backupPressure: 15, backupFrequency: 12 },
      fisiologia: { ...PRESET_FISIOLOGIA.polmonite.fisiologia, ...catetereGiusto, nme: 1 },
      drive: { frequenza: 26, intensita: 0.6, responsivo: true },
      asincronia: null,
      vitali: { spo2: 93, etco2: 40, heartRate: 100, map: 80 },
    },
  },
  {
    id: 'niv-bpco-perdita',
    nome: { it: 'BPCO in NIV, la maschera che perde', en: 'COPD on NIV, the leaking mask' },
    nota: {
      it: 'NIV PS 12 su PEEP 5, perdita di 30 l/min e auto-PEEP: la PS cicla tardi (Ti intorno a 1,3 s contro 0,7 del diaframma) e metà degli sforzi non apre l’atto, che arriva dal backup. Il catetere è montato: in NEURO ogni sforzo apre il suo atto (FR 24 come il paziente) e il Ti torna quello del diaframma, con la stessa perdita. Si può provare prima ad alzare il ciclaggio della PS e a sistemare la maschera.',
      en: 'NIV PS 12 over PEEP 5, 30 l/min leak and auto-PEEP: PS cycles late (Ti around 1.3 s against the diaphragm’s 0.7) and half of the efforts do not open a breath, which comes from the backup. The catheter is mounted: in NEURO every effort opens its own breath (RR 24 like the patient) and Ti goes back to the diaphragm’s, with the same leak. Try raising the PS cycling threshold and refitting the mask first.',
    },
    riferimento: BERTRAND_2013,
    preset: 'bpco',
    scenario: {
      app: 'open-vent-sim', kind: 'scenario', version: 1, name: 'BPCO in NIV con perdita',
      ambiente: 'niv', modalita: 'PS',
      impostazioni: { psLevel: 12, peep: 5, fio2: 35, flowCycleOffPercent: 25, livelloNeuro: 1, triggerEAdi: 0.5 },
      fisiologia: { ...PRESET_FISIOLOGIA.bpco.fisiologia, ...catetereGiusto, nme: 0.5, perditaMaschera: 30 },
      drive: { frequenza: 24, intensita: 0.5 },
      asincronia: null,
      vitali: { spo2: 90, etco2: 58, heartRate: 105, map: 90 },
    },
  },
  {
    id: 'af-cannula',
    nome: { it: 'Alto flusso: la cannula fuori dal naso', en: 'High flow: the cannula out of the nose' },
    nota: {
      it: 'Polmonite in alto flusso, 50 l/min al 60%: SpO₂ 92, FR 28, ROX intorno a 5,5 (in regia). Togliere la cannula dal naso dalla scheda «Sforzo e parete»: l’apparecchio non suona e il flusso resta 50, la SpO₂ scende in qualche minuto. Lo si scopre guardando il paziente.',
      en: 'Pneumonia on high flow, 50 l/min at 60%: SpO₂ 92, RR 28, ROX around 5.5 (on the console). Take the cannula out of the nose from the «Effort and wall» tab: the device does not alarm and the flow stays 50, SpO₂ falls within minutes. Only looking at the patient finds it.',
    },
    riferimento: ROCA_2019,
    preset: 'polmonite',
    scenario: {
      app: 'open-vent-sim', kind: 'scenario', version: 1, name: 'Alto flusso, cannula fuori dal naso',
      ambiente: 'alto-flusso', modalita: 'AF',
      impostazioni: { fgf: 50, fio2: 60, temperature: 37 },
      fisiologia: { ...PRESET_FISIOLOGIA.polmonite.fisiologia },
      drive: { frequenza: 28, intensita: 0.6 },
      asincronia: null,
      vitali: { spo2: 92, etco2: 34, heartRate: 110, map: 80 },
    },
  },
  {
    id: 'catetere-nex',
    nome: { it: 'Il catetere alla profondità della regola', en: 'The catheter at the rule’s depth' },
    nota: {
      it: 'NEX 50 cm: il catetere è inserito dal naso a 63 cm, come dice la regola. Ma in questo paziente il diaframma sta 2,5 cm più in basso: nella schermata «Catetere EAdi» l’attività si accende nelle derivazioni basse e il segnale è sporco. Uno o due passi più dentro e il diaframma torna al centro. Succede in un paziente su tre.',
      en: 'NEX 50 cm: the catheter is inserted nasally to 63 cm, as the rule says. But this patient’s diaphragm sits 2.5 cm lower: on the «EAdi catheter» screen the activity lights up in the lower leads and the signal is noisy. One or two steps deeper and the diaphragm is back in the centre. It happens in one patient out of three.',
    },
    riferimento: BARWING_2009,
    preset: 'normale',
    scenario: {
      app: 'open-vent-sim', kind: 'scenario', version: 1, name: 'Catetere alla profondità della regola',
      ambiente: 'invasiva', modalita: 'PS',
      impostazioni: { psLevel: 10, peep: 5, fio2: 40, livelloNeuro: 0.8, triggerEAdi: 0.5 },
      fisiologia: { ...PRESET_FISIOLOGIA.normale.fisiologia, ...NEX_CASO, catetereVia: 'nasale', ...catetereAllaRegola },
      drive: { frequenza: 18, intensita: 0.5 },
      asincronia: null,
      vitali: { spo2: 96, etco2: 40, heartRate: 85, map: 85 },
    },
  },
  {
    id: 'svezzamento-eadi',
    nome: { it: 'Svezzamento difficile: l’EAdi che la Paw non dice', en: 'Difficult weaning: the EAdi the Paw does not show' },
    nota: {
      it: 'PS 8 su PEEP 5: VT e FR sembrano accettabili, ma il diaframma è debole (NME 0,38 cmH₂O/µV) e per lo stesso sforzo serve un comando molto più grande: EAdi picco sopra 15 µV. Un paziente che lavora troppo. In NEURO, con il livello giusto, l’EAdi torna nel range.',
      en: 'PS 8 over PEEP 5: VT and RR look acceptable, but the diaphragm is weak (NME 0.38 cmH₂O/µV) and the same effort needs a much larger command: EAdi peak above 15 µV. A patient working too hard. In NEURO at the right level, EAdi comes back into range.',
    },
    riferimento: DOORDUIN_2018,
    preset: 'normale',
    scenario: {
      app: 'open-vent-sim', kind: 'scenario', version: 1, name: 'Svezzamento difficile, EAdi alto',
      ambiente: 'invasiva', modalita: 'PS',
      impostazioni: { psLevel: 8, peep: 5, fio2: 35, livelloNeuro: 1, triggerEAdi: 0.5 },
      fisiologia: { ...PRESET_FISIOLOGIA.normale.fisiologia, ...catetereGiusto, nme: 0.38 },
      drive: { frequenza: 24, intensita: 0.8, responsivo: true },
      asincronia: null,
      vitali: { spo2: 95, etco2: 44, heartRate: 100, map: 85 },
    },
  },

];
