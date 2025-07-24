
import { en as enAlarms, it as itAlarms } from './translations/alarms';
import { en as enGases, it as itGases } from './translations/gases';
import { en as enGeneral, it as itGeneralTranslations } from './translations/general'; // aliased 'it' import
import { en as enManual, it as itManual } from './translations/manual';
import { en as enModes, it as itModes } from './translations/modes';
import { en as enParameters, it as itParameters } from './translations/parameters';
import { en as enPostScreen, it as itPostScreen } from './translations/postScreen';
import { en as enRecording, it as itRecording } from './translations/recording';
import { en as enSelfTest, it as itSelfTest } from './translations/selfTest';
import { en as enSimulatorSettings, it as itSimulatorSettings } from './translations/simulatorSettings';

const enCombined = {
  ...enGeneral,
  ...enParameters,
  ...enAlarms,
  ...enModes,
  ...enGases,
  ...enPostScreen,
  ...enSelfTest,
  ...enSimulatorSettings,
  ...enManual,
  ...enRecording,
};

const itCombined = {
  ...itGeneralTranslations, // use aliased import
  ...itParameters,
  ...itAlarms,
  ...itModes,
  ...itGases,
  ...itPostScreen,
  ...itSelfTest,
  ...itSimulatorSettings,
  ...itManual,
  ...itRecording,
};

export type TranslationKeys = keyof typeof enCombined;

export type Translations = Record<TranslationKeys, string>;

export const translations: Record<'en' | 'it', Translations> = {
  en: enCombined,
  it: itCombined,
};

// Helper to ensure all keys are present in Italian, for development (optional, can be removed)
// This ensures that if a key is in enCombined, it must also be in itCombined.
// The actual content of itCombined should provide the correct Italian translation.
function validateItalianTranslations(en: Translations, it: Translations) {
  const enKeys = Object.keys(en) as TranslationKeys[];
  let allItalianKeysPresent = true;
  for (const key of enKeys) {
    if (!(key in it) || it[key] === undefined) {
      console.warn(`Missing Italian translation for key "${key}". Using English text as fallback.`);
      (it as any)[key] = en[key]; // Fallback to English if missing
      allItalianKeysPresent = false;
    }
  }
  if (allItalianKeysPresent) {
    console.log("All English keys have corresponding Italian translations.");
  }
}

// Perform validation (optional, for development feedback)
validateItalianTranslations(enCombined, itCombined);
