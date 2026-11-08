
import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';
import { translations, Translations } from '../i18n/locales';

type Language = 'en' | 'it';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default: the browser's language (Italian or English), remembered across sessions.
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('ovs-language');
      if (saved === 'it' || saved === 'en') return saved;
    } catch { /* storage unavailable */ }
    return typeof navigator !== 'undefined' && /^it\b/i.test(navigator.language || '') ? 'it' : 'en';
  });
  const setLanguage = (l: Language) => {
    setLanguageState(l);
    try { localStorage.setItem('ovs-language', l); } catch { /* ignore */ }
  };

  const t = useMemo(() => translations[language], [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
