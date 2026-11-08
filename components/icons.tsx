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

/** Anaesthesia workstation: monitor on top, vaporizer on the side, bellows in a housing, castors. */
export const AnesthesiaMachineIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="5" y="2.5" width="11" height="6.5" rx="1" />
    <path d="M7 7l1.6-2.2 1.4 1.5 1.6-2.3 1.4 2" />
    <rect x="4" y="10.5" width="13" height="8" rx="1.2" />
    <path d="M8 12.5v4M10.5 12.5v4M13 12.5v4" />
    <path d="M17 12h2.2a.8.8 0 0 1 .8.8v3.4a.8.8 0 0 1-.8.8H17" />
    <path d="M18.6 13.4v2.2" />
    <path d="M6 18.5v1.5M15 18.5v1.5" />
    <circle cx="6" cy="21" r="0.9" />
    <circle cx="15" cy="21" r="0.9" />
  </Svg>
);

/** ICU ventilator: touch screen with a pressure curve, on a pole, with the patient circuit. */
export const IcuVentilatorIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="14" height="10" rx="1.5" />
    <path d="M5 10h2l1-4.5h3.2l.8 4.5H15" />
    <path d="M10 13v6.5" />
    <path d="M6.5 21.5L10 19.5l3.5 2" />
    <path d="M17 6.5c2.4 0 3.8 1.2 3.8 3.2v2.1c0 1.5-.9 2.4-2.3 2.4" />
    <path d="M17 9.5c1.1 0 1.6.5 1.6 1.4" />
  </Svg>
);

/** High-flow oxygen: nasal cannula on a face profile, with warm flow lines. */
export const HighFlowIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M9.5 3.5c-3 .6-5 3.2-5 6.6 0 1.6.4 2.8 1 3.8L4.6 17c-.2.6.2 1 .8 1h1.2v2.5c0 .6.4 1 1 1h2.6" />
    <path d="M9.5 3.5c.6 1.6 1.1 3.6 1.1 5.4 0 .9-.4 1.6-1.1 1.9" />
    <path d="M10.6 10.8h3.4c1.6 0 2.4.8 2.4 2" />
    <path d="M9.6 12.8c-1.5 0-2.4.9-2.4 2.1" />
    <path d="M18.5 7.5c.8.8.8 2 0 2.8M20.5 6c1.6 1.6 1.6 4.2 0 5.8" />
  </Svg>
);

/** Director console: slate with a play mark and a link wave. */
export const DirectorIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="12.5" rx="1.5" />
    <path d="M3 8l2.2-4.3 3.5 1.1M9.5 5.1l3.3 1M16 7.2l2.5.8" />
    <path d="M10.5 11.5v5.5l4.5-2.75z" />
  </Svg>
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

export const GearIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    <circle cx="12" cy="12" r="6.6" />
  </Svg>
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

export const TourIcon: React.FC<P> = (p) => (
  <Svg {...p}><path d="M12 3l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.3-5.3 3.3 1.4-6-4.6-4 6.1-.5z" /></Svg>
);

/** Invasive ventilation: head profile with an endotracheal tube to the circuit. */
export const IntubatedIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M10 3.5c-3.2.4-5.5 3-5.5 6.4 0 1.6.4 2.9 1.1 3.9l-1 2.9c-.2.6.2 1.1.8 1.1h1.3v2.4c0 .6.4 1 1 1h2.8" />
    <path d="M10 3.5c1.3 1.4 2 3.4 2 5.5" />
    <path d="M8.2 12.6h4.3c.8 0 1.3.5 1.3 1.3v5.6" />
    <path d="M13.8 19.5h3.7a2 2 0 0 0 2-2v-3" />
    <path d="M17.6 12.6h3.8v1.9h-3.8z" />
  </Svg>
);

/** Non-invasive ventilation: face mask with straps and the circuit. */
export const NivMaskIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 4.5c-2.6 0-4.6 2.6-5.4 6.4-.6 2.9.4 5.4 2.6 6.4 1.7.7 4 .7 5.6 0 2.2-1 3.2-3.5 2.6-6.4C16.6 7.1 14.6 4.5 12 4.5z" />
    <path d="M9.5 13.5c1.6.9 3.4.9 5 0" />
    <path d="M6.7 9.5L3 8M17.3 9.5L21 8M7 15.5l-3.5 2M17 15.5l3.5 2" />
    <path d="M12 17.8v3.7" />
  </Svg>
);
