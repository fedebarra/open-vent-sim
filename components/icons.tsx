/**
 * Open Vent Sim line icons — original drawings, MIT like the rest of the project.
 * 24×24 grid, 1.5 stroke, round caps, colour from `currentColor`.
 */
import React from 'react';

type P = { size?: number; className?: string; strokeWidth?: number; title?: string };

const Svg: React.FC<P & { children: React.ReactNode }> = ({ size = 24, className, strokeWidth = 1.5, title, children }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={className}
    fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);





/** Learner device joining the classroom: tablet with an incoming signal. */
export const LearnerDeviceIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="4" y="7" width="12" height="14" rx="1.8" />
    <path d="M9 18.5h2" />
    <path d="M6.5 13h2l.8-2.5 1.4 4.5.8-2H13.5" />
    <path d="M18 5.5a3.5 3.5 0 0 1 0 5M20 3.5a6.3 6.3 0 0 1 0 9" />
  </Svg>
);

/** Single user, no network. */
export const SoloIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20.5c.7-3.6 3.4-5.8 7-5.8s6.3 2.2 7 5.8" />
  </Svg>
);

export const BookIcon: React.FC<P> = (p) => (
  <Svg {...p}><path d="M12 6.5C10.2 5 7.8 4.5 4 4.6v13.6c3.8-.1 6.2.4 8 1.9 1.8-1.5 4.2-2 8-1.9V4.6c-3.8-.1-6.2.4-8 1.9z" /><path d="M12 6.5v13.6" /></Svg>
);


export const ExpandIcon: React.FC<P> = (p) => (
  <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>
);

export const CollapseIcon: React.FC<P> = (p) => (
  <Svg {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Svg>
);

export const RecordIcon: React.FC<P & { active?: boolean }> = ({ active, ...p }) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" fill={active ? 'currentColor' : 'none'} /></Svg>
);

// ---------------------------------------------------------------------------
// The big tiles: illustrated and filled. They keep their own colours: they sit
// on coloured tiles, where a line icon read as something else (an easel, a
// radio on wheels, a voice, an insect). Checked at 24 px for unwanted readings.
// ---------------------------------------------------------------------------

/** Anaesthesia workstation: cart with drawers and castors, flowmeters, pressure curve on the monitors, CO₂ absorber, reservoir bag. */
export const AnesthesiaMachineIcon: React.FC<P> = ({ size = 24, className, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
      <path d="M30 22 H44" stroke="#17293a" strokeWidth="3" strokeLinecap="round"/>
      <rect x="4" y="10" width="28" height="20" rx="4" fill="#0b1220" stroke="#17293a" strokeWidth="3"/>
      <path d="M7 26 H10 L17 14 L19 17.5 H21.5 L23 26 H29" fill="none" stroke="#f5c542" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="44" y="8" width="46" height="74" rx="6" fill="#e9eef2" stroke="#17293a" strokeWidth="3"/>
      <rect x="49" y="13" width="20" height="16" rx="2.5" fill="#0b1220" stroke="#17293a" strokeWidth="2"/>
      <path d="M51 26 L56.5 17 L58 19.5 H60 L61.5 26 H67" fill="none" stroke="#f5c542" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="73" y="13" width="5" height="18" rx="2.5" fill="#dceef5" stroke="#17293a" strokeWidth="2"/><rect x="81" y="13" width="5" height="18" rx="2.5" fill="#dceef5" stroke="#17293a" strokeWidth="2"/>
      <circle cx="75.5" cy="21" r="2" fill="#0d9488"/><circle cx="83.5" cy="26" r="2" fill="#f2c94c"/>
      <rect x="38" y="36" width="56" height="6" rx="2.5" fill="#c3ccd3" stroke="#17293a" strokeWidth="2.4"/>
      <path d="M52 52 H82 M52 62 H82 M52 72 H82" stroke="#17293a" strokeWidth="2.4" strokeLinecap="round" strokeOpacity=".7"/>
      <rect x="44" y="82" width="46" height="5" rx="2" fill="#4a5560" stroke="#17293a" strokeWidth="2"/>
      <circle cx="50" cy="91" r="5" fill="#4a5560" stroke="#17293a" strokeWidth="2.2"/><circle cx="84" cy="91" r="5" fill="#4a5560" stroke="#17293a" strokeWidth="2.2"/>
      <rect x="26" y="44" width="14" height="22" rx="3" fill="#ede9fe" stroke="#17293a" strokeWidth="2.6"/>
      <path d="M29 50 h8 M29 55 h8 M29 60 h8" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M26 52 C18 52 16 56 15 62" fill="none" stroke="#17293a" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M15 62 C6 64 4 76 8 84 C11 90 19 90 22 84 C26 76 24 64 15 62 Z" fill="#3d6fa8" stroke="#17293a" strokeWidth="2.6"/>
  </svg>
);
/** ICU ventilator: the flow curve on the screen, the two limbs entering the tips of the Y piece. */
export const IcuVentilatorIcon: React.FC<P> = ({ size = 24, className, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
      <rect x="4" y="14" width="62" height="50" rx="8" fill="#e9eef2" stroke="#17293a" strokeWidth="3"/>
      <rect x="11" y="21" width="48" height="32" rx="4" fill="#0b1220"/>
      <path d="M14 37 H15.5" stroke="#2dd4bf" strokeOpacity=".35" strokeWidth="1.5"/>
      <path d="M14 37 H18 L21 24 C27 26 32 30 36 33 L37.5 37 L39 49 C41.5 43 46 39 56 37.5" fill="none" stroke="#2dd4bf" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="16" y="64" width="38" height="6" rx="3" fill="#c3ccd3" stroke="#17293a" strokeWidth="2.2"/>
      <path d="M66 28 C86 28 94 40 94 58" fill="none" stroke="#17293a" strokeWidth="10" strokeLinecap="round"/><path d="M66 28 C86 28 94 40 94 58" fill="none" stroke="#e7eef3" strokeWidth="6.5" strokeLinecap="round"/><path d="M66 28 C86 28 94 40 94 58" fill="none" stroke="#17293a" strokeOpacity=".35" strokeWidth="6.5" strokeDasharray="1 3.2"/><path d="M66 50 C74 50 78 53 78 58" fill="none" stroke="#17293a" strokeWidth="10" strokeLinecap="round"/><path d="M66 50 C74 50 78 53 78 58" fill="none" stroke="#e7eef3" strokeWidth="6.5" strokeLinecap="round"/><path d="M66 50 C74 50 78 53 78 58" fill="none" stroke="#17293a" strokeOpacity=".35" strokeWidth="6.5" strokeDasharray="1 3.2"/>
      <path d="M78 60 L86 72 L94 60 M86 72 V82" fill="none" stroke="#17293a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M78 60 L86 72 L94 60 M86 72 V82" fill="none" stroke="#3d6fa8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="81" y="82" width="10" height="10" rx="2.5" fill="#e7eef3" stroke="#17293a" strokeWidth="2.4"/>
  </svg>
);
/** High-flow nasal cannula: the pad with two prongs, the strap and the heated tube. No face. */
export const HighFlowIcon: React.FC<P> = ({ size = 24, className, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
      <path d="M6 54 C16 30 84 30 94 54" fill="none" stroke="#17293a" strokeWidth="7" strokeLinecap="round"/>
      <path d="M6 54 C16 30 84 30 94 54" fill="none" stroke="#7dd3c0" strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M30 40 V24 C30 18 40 18 40 24 V40 M60 40 V24 C60 18 70 18 70 24 V40" fill="#e6eef4" stroke="#17293a" strokeWidth="3" strokeLinejoin="round"/>
      <rect x="22" y="38" width="56" height="14" rx="7" fill="#e6eef4" stroke="#17293a" strokeWidth="3"/>
      <path d="M78 45 C90 48 90 66 84 94" fill="none" stroke="#17293a" strokeWidth="14" strokeLinecap="round"/>
      <path d="M78 45 C90 48 90 66 84 94" fill="none" stroke="#e8eef2" strokeWidth="9.5" strokeLinecap="round"/>
  </svg>
);
/** Invasive ventilation: the endotracheal tube — 15 mm connector, Magill curve, round cuff, bevelled tip, pilot balloon. */
export const IntubatedIcon: React.FC<P> = ({ size = 24, className, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
      <path d="M22 25 C 8 60, 20 84, 74 90" fill="none" stroke="#17293a" strokeWidth="12" strokeLinecap="butt"/>
      <path d="M22 25 C 8 60, 20 84, 74 90" fill="none" stroke="#eef5f8" strokeWidth="8"/>
      <path d="M22 25 C 8 60, 20 84, 74 90" fill="none" stroke="#5b8fc9" strokeWidth="1.6"/>
      <path d="M71.5 83.8 L76.5 96.2" stroke="#17293a" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="57" cy="88.2" r="9.5" fill="#bfe0f2" fillOpacity=".85" stroke="#17293a" strokeWidth="2.4"/>
      <path d="M18.5 52 C 36 50, 52 40, 63 32" fill="none" stroke="#17293a" strokeWidth="2"/>
      <path d="M59 20 C 59 13, 71 13, 71 20 L 70 32 Q 65 35 60 32 Z" fill="#a8d2ec" stroke="#17293a" strokeWidth="2.2"/>
      <rect x="60.5" y="7" width="9" height="8" rx="2" fill="#ffffff" stroke="#17293a" strokeWidth="2"/>
      <rect x="17.5" y="2" width="9" height="10" rx="2" fill="#dfe5ea" stroke="#17293a" strokeWidth="2.4"/>
      <rect x="18" y="11" width="8" height="14" rx="2" fill="#f6f8f9" stroke="#17293a" strokeWidth="2.2"/>
  </svg>
);
/** Non-invasive ventilation: the oronasal mask with forehead support and elbow. */
export const NivMaskIcon: React.FC<P> = ({ size = 24, className, title }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -2 100 150" width={size} height={size} className={className}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
      <path d="M4 78 L16 76 M96 78 L84 76 M10 12 L34 18 M90 12 L66 18" fill="none" stroke="#17293a" strokeWidth="7" strokeLinecap="round"/>
      <path d="M4 78 L16 76 M96 78 L84 76 M10 12 L34 18 M90 12 L66 18" fill="none" stroke="#4a5560" strokeWidth="4" strokeLinecap="round"/>
      <rect x="44" y="10" width="12" height="40" rx="4" fill="#c3ccd3" stroke="#17293a" strokeWidth="2.4"/>
      <rect x="30" y="6" width="40" height="16" rx="8" fill="#e9eef2" stroke="#17293a" strokeWidth="2.4"/>
      <path d="M50 38 C 66 38, 90 92, 90 110 C 90 128, 72 134, 50 134 C 28 134, 10 128, 10 110 C 10 92, 34 38, 50 38 Z" fill="#e9f4f8" stroke="#17293a" strokeWidth="3"/>
      <path d="M50 50 C 62 50, 80 94, 80 108 C 80 120, 66 124, 50 124 C 34 124, 20 120, 20 108 C 20 94, 38 50, 50 50 Z" fill="#f6fbfd" stroke="#17293a" strokeWidth="1.6"/>
      <circle cx="50" cy="104" r="14" fill="#3d6fa8" stroke="#17293a" strokeWidth="2.6"/>
      <path d="M50 118 L50 146" stroke="#17293a" strokeWidth="17" strokeLinecap="round"/><path d="M50 118 L50 146" stroke="#e7eef3" strokeWidth="12"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Small line icons (24 grid, 1.75 stroke).
// ---------------------------------------------------------------------------

/** Settings: a cog with teeth (the old one, with rays, read as brightness). */
export const GearIcon: React.FC<P> = (p) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.75}>
      <path d="M10.3 3h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7L3 13.7v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z"/><circle cx="12" cy="12" r="3"/>
  </Svg>
);
/** Guided tour: a compass. */
export const TourIcon: React.FC<P> = (p) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.75}>
      <circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>
  </Svg>
);
/** Instructor console: a desk of sliders — the one who adjusts the case. */
export const DirectorIcon: React.FC<P> = (p) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.75}>
      <rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/><path d="M5.5 13h3M10.5 10h3M15.5 14.5h3"/>
  </Svg>
);

/**
 * The Open Vent Sim mark: two pressure-support breaths of the flow curve,
 * white on flat teal, running edge to edge along the zero line.
 */
export const BrandMark: React.FC<{ size?: number; className?: string; title?: string }> = ({ size = 32, className, title }) => {
  const clip = `ovs-mark-${React.useId().replace(/:/g, '')}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <clipPath id={clip}><rect x="4" y="4" width="92" height="92" rx="22" /></clipPath>
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#0d9488" />
      <g clipPath={`url(#${clip})`}>
        <path d="M-4 50 H10 L14 20 C21 24 27 32 32 38 L34 50 L36 76 C40 62 46 54 56 51.5 H58 L62 20 C69 24 75 32 80 38 L82 50 L84 76 C88 62 94 54 108 51.5" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

/** The mark's flow curve, for files that cannot use the component (icon renderer, favicon). */
export const BRAND_MARK_PATH = 'M-4 50 H10 L14 20 C21 24 27 32 32 38 L34 50 L36 76 C40 62 46 54 56 51.5 H58 L62 20 C69 24 75 32 80 38 L82 50 L84 76 C88 62 94 54 108 51.5';
