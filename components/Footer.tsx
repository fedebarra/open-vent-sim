
import React from 'react';
import { useLanguage } from '../src/contexts/LanguageContext'; // Corrected path

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="w-full bg-gray-900 p-2 text-center text-gray-400 text-xs h-auto flex flex-col md:flex-row items-center justify-center border-t border-gray-700 flex-shrink-0 leading-tight space-y-1 md:space-y-0 md:space-x-2">
      <p dangerouslySetInnerHTML={{ __html: t.startupFooterDisclaimer.replace('<em><strong>Federico Lorenzo Barra, MD</strong></em>', '<em class="text-white"><strong>Federico Lorenzo Barra, MD</strong></em>') }} />
      <p className="hidden md:inline">|</p>
      <p dangerouslySetInnerHTML={{ __html: t.startupFooterBuyCoffee.replace('<em><strong>buying me a coffee</strong></em>', '<em class="text-white"><strong>buying me a coffee</strong></em>') }} />
      <p className="hidden md:inline">|</p>
      <div className="flex items-center justify-center space-x-1">
        <span dangerouslySetInnerHTML={{ __html: t.startupFooterLicense }} />
        {/* QR Code Removed */}
      </div>
    </footer>
  );
};
