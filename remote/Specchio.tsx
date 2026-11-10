/**
 * OVS 3.3 — a screen that shows **another screen's machine** (classroom feedback:
 * the projector and the tablets must show the same ventilator, not ask again which
 * one). The machine runs on its owner; this screen draws the owner's snapshot with
 * the same engine (the curves are deterministic from the snapshot and the clock)
 * and sends every tap to the owner, which applies it as the learner's and sends
 * the new snapshot back.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import '../device/device.css';
import { Ventilatore } from '../device/screens/scenario/ventilatore/Ventilatore';
import { statoDa, type VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';
import type { AzioneVentilatore } from '../device/screens/scenario/ventilatore/azioni';
import type { RemoteStrings } from './strings';

export interface SpecchioProps {
  ist: VentIstantanea;
  /** Owner clock minus this screen's clock, ms: both screens draw the same instant. */
  offsetMs: number;
  didattica: boolean;
  s: RemoteStrings;
  onAzione: (a: AzioneVentilatore) => void;
  onStacca: () => void;
}

export const Specchio: React.FC<SpecchioProps> = ({ ist, offsetMs, didattica, s, onAzione, onStacca }) => {
  const istRef = useRef(ist); istRef.current = ist;
  const offRef = useRef(offsetMs); offRef.current = offsetMs;
  const clock = useCallback(() => Math.max(0, (Date.now() + offRef.current - istRef.current.accesoDa) / 1000), []);
  const stato = useMemo(() => statoDa(ist), [ist]);
  const [pieno, setPieno] = useState(false);
  const [chiedi, setChiedi] = useState(false);
  const togglePieno = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().then(() => setPieno(true)).catch(() => {});
    else void document.exitFullscreen().then(() => setPieno(false)).catch(() => {});
  };
  return (
    <div className="ovs-device" data-testid="device-mirror" style={{ position: 'fixed', inset: 0, background: '#0a0f1a' }}>
      <Ventilatore
        stato={stato}
        misure={ist.misure}
        allarmi={ist.allarmi}
        limiti={ist.limiti}
        silenziatoFinoA={ist.silenziatoFinoA}
        // The owner sounds the alarms: two screens beeping in the same room are noise.
        suoniAttivi={false}
        pienoSchermo={pieno}
        onPienoSchermo={togglePieno}
        clock={clock}
        manovraDa={ist.manovraDa ?? null}
        riempimentoDa={ist.riempimentoDa ?? null}
        riempimentoCosa={ist.riempimentoCosa ?? null}
        manovraEsito={ist.manovraEsito ?? null}
        autotestMs={ist.autotestA != null ? ist.accesoDa + ist.autotestA * 1000 : null}
        operabile
        regiaViva
        onAzione={onAzione}
        onEsci={() => setChiedi(true)}
        pressioniDidattiche={didattica}
      />
      {chiedi && (
        <Avviso>
          <p className="text-lg text-slate-100 mb-5">{s.mirrorDetachAsk}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button data-testid="mirror-detach" onClick={onStacca} className="px-5 py-3 rounded-xl bg-sky-700 text-white font-semibold">{s.mirrorDetach}</button>
            <button onClick={() => setChiedi(false)} className="px-5 py-3 rounded-xl bg-slate-700 text-white">{s.cancel}</button>
          </div>
        </Avviso>
      )}
    </div>
  );
};

/** A centred notice over the screen. */
export const Avviso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(2,6,23,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl" style={{ fontFamily: 'system-ui, Arial, sans-serif' }}>
      {children}
    </div>
  </div>
);
