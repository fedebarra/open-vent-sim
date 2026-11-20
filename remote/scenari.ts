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

];
