
import React from 'react';
import { useLanguage } from '../src/contexts/LanguageContext';
import { THEME_CONFIG } from '../constants';
import { ThemeName, TranslationKeys } from '../types';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTheme: ThemeName;
}

interface ManualSection {
  titleKey: TranslationKeys;
  contentKeys: TranslationKeys[];
  subsections?: ManualSection[]; // For nested structure
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose, currentTheme }) => {
  const { t } = useLanguage();
  const themeColors = THEME_CONFIG[currentTheme] || THEME_CONFIG.icu; 

  if (!isOpen) return null;

  const manualContent: ManualSection[] = [
    { titleKey: 'manual_intro_title', contentKeys: ['manual_intro_p1', 'manual_intro_p2'] },
    { 
      titleKey: 'manual_navigation_title', 
      contentKeys: [
        'manual_navigation_p1_header', 
        'manual_navigation_p2_left_panel', 
        'manual_navigation_p3_graphs_panel', 
        'manual_navigation_p4_right_panel',
        'manual_navigation_p5_footer'
      ] 
    },
    { 
      titleKey: 'manual_startup_title', 
      contentKeys: [
        'manual_startup_p1_modes', 
        'manual_startup_p2_post', 
        'manual_startup_p3_patient_data',
        'manual_startup_p4_utilities_title',
        'manual_startup_p4_manual_button',
        'manual_startup_p4_record_button',
        'manual_startup_p4_settings_button',
      ] 
    },
    { 
      titleKey: 'manual_anesthesia_title', 
      contentKeys: ['manual_anesthesia_p1_overview'],
      subsections: [
        { titleKey: 'manual_anesthesia_left_panel_title', contentKeys: ['manual_anesthesia_lp_p1_vent_toggle', 'manual_anesthesia_lp_p2_gas_selection', 'manual_anesthesia_lp_p3_parameters', 'manual_anesthesia_lp_p4_gas_toggle', 'manual_anesthesia_lp_p5_consumables']},
        { titleKey: 'manual_anesthesia_right_panel_title', contentKeys: ['manual_anesthesia_rp_p1_monitoring', 'manual_anesthesia_rp_p2_o2_flush']},
        { titleKey: 'manual_anesthesia_header_title', contentKeys: ['manual_anesthesia_h_p1_status']},
      ]
    },
    { 
      titleKey: 'manual_icu_title', 
      contentKeys: ['manual_icu_p1_overview'],
      subsections: [
        { titleKey: 'manual_icu_left_panel_title', contentKeys: ['manual_icu_lp_p1_mode_selection', 'manual_icu_lp_p2_parameters', 'manual_icu_lp_p3_maneuvers', 'manual_icu_lp_p4_humidifier']},
        { titleKey: 'manual_icu_right_panel_title', contentKeys: ['manual_icu_rp_p1_monitoring', 'manual_icu_rp_p2_start_standby']},
        { titleKey: 'manual_icu_graphs_panel_title', contentKeys: ['manual_icu_gp_p1_waveforms', 'manual_icu_gp_p2_freeze']},
      ]
    },
    { 
      titleKey: 'manual_highflow_title', 
      contentKeys: ['manual_highflow_p1_overview'],
      subsections: [
        { titleKey: 'manual_highflow_left_panel_title', contentKeys: ['manual_highflow_lp_p1_parameters', 'manual_highflow_lp_p2_humidifier']},
        { titleKey: 'manual_highflow_right_panel_title', contentKeys: ['manual_highflow_rp_p1_start_standby']},
        { titleKey: 'manual_highflow_graphs_panel_title', contentKeys: ['manual_highflow_gp_p1_animation']},
      ]
    },
    { titleKey: 'manual_alarms_title', contentKeys: ['manual_alarms_p1_access', 'manual_alarms_p2_settings'] },
    { titleKey: 'manual_humidifier_title', contentKeys: ['manual_humidifier_p1_icu_hf'] },
    { 
      titleKey: 'manual_instructor_guide_title', 
      contentKeys: ['manual_instructor_intro'],
      subsections: [
        { titleKey: 'manual_instructor_anesthesia_tab_title', contentKeys: ['manual_instructor_an_p1_vaporizers', 'manual_instructor_an_p2_consumables', 'manual_instructor_an_p3_defaults']},
        { titleKey: 'manual_instructor_patient_profile_tab_title', contentKeys: ['manual_instructor_pp_p1_demographics', 'manual_instructor_pp_p2_physiology', 'manual_instructor_pp_p3_presets', 'manual_instructor_pp_p4_waveform_factors']},
        { titleKey: 'manual_instructor_vent_defaults_tab_title', contentKeys: ['manual_instructor_vd_p1_initial_params', 'manual_instructor_vd_p2_default_modes']},
        { titleKey: 'manual_instructor_general_tab_title', contentKeys: ['manual_instructor_ge_p1_post', 'manual_instructor_ge_p2_humidifier', 'manual_instructor_ge_p3_alarms']},
      ]
    },
    { titleKey: 'manual_conclusion_title', contentKeys: ['manual_conclusion_p1'] },
  ];

  const renderSection = (section: ManualSection, level: number = 0) => (
    <div key={section.titleKey} className={level > 0 ? 'ml-4' : ''}>
      <h4 
        className={`font-semibold mb-2 ${
            level === 0 ? `text-xl text-${themeColors.accent} mt-4 border-b border-gray-600 pb-1` : 
            level === 1 ? `text-lg text-${themeColors.primaryLight} mt-3` :
                          `text-base text-gray-300 mt-2`
        }`}
      >
        {t[section.titleKey]}
      </h4>
      {section.contentKeys.map(pKey => {
        const content = t[pKey];
        // Basic list detection (ul/li) for HTML content
        if (content.startsWith('<ul>') && content.endsWith('</ul>')) {
          return <div key={pKey} className="mb-2 leading-relaxed text-gray-300" dangerouslySetInnerHTML={{ __html: content.replace(/<li>/g, '<li class="ml-5 list-disc">') }} />;
        }
        return <p key={pKey} className="mb-2 leading-relaxed text-gray-300" dangerouslySetInnerHTML={{ __html: content }} />;
      })}
      {section.subsections && section.subsections.map(sub => renderSection(sub, level + 1))}
    </div>
  );


  return (
    <div
      className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl border-2 ${themeColors.border} flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10`}>
          <h3 className={`text-2xl font-semibold text-${themeColors.accent}`}>{t.manualModalTitle}</h3>
          <button
            onClick={onClose}
            className={`text-gray-300 hover:text-white text-3xl leading-none`}
            aria-label="Close"
            title={t.modalCancel}
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 text-sm">
          {manualContent.map(section => renderSection(section))}
        </div>

        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800/80 flex justify-end sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className={`px-5 py-2 text-sm rounded-md font-semibold
                        bg-gray-600 text-white hover:bg-gray-500 transition-colors`}
          >
            {t.modalCancel}
          </button>
        </div>
      </div>
    </div>
  );
};
