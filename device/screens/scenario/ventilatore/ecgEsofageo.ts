/**
 * Le quattro derivazioni ECG del catetere dell'EAdi, campione per campione.
 *
 * Un treno di battiti per derivazione (`monitor/beats.ts`), tutti con lo stesso
 * seme e lo stesso piano nel tempo: battono negli stessi istanti, e cambia
 * solo quanto sono grandi P, QRS e T — quello che dice `catetere.ts` della
 * derivazione. Il ritmo è sinusale e regolare, e la R cade sui multipli del
 * periodo: lo stesso istante in cui il residuo dell'ECG entra nell'EAdi letta
 * da un catetere troppo superficiale (`eadi.ts`). Chi guarda le due cose
 * insieme vede lo stesso cuore.
 *
 * Quando il catetere si sposta o la frequenza cambia, il piano nuovo vale dal
 * battito successivo: niente QRS tagliati a metà.
 */

import { beatPoints, createBeatTrain, planFor, seeded, type Beat, type BeatTrain, type Plan } from '../monitor/beats'
import type { Derivazione } from './catetere'

/** Le ampiezze in millivolt della derivazione più alta: la P vicino all'atrio sinistro supera il QRS. */
const P_MV = 4
const QRS_MV = 2
const T_SU_R = 0.3

export interface EcgEsofageo {
  /** La derivazione `k` (0 la più alta) all'istante `t`, mV. */
  at: (k: number, t: number) => number
  /** Il catetere si è spostato, o il cuore va a un'altra frequenza. */
  aggiorna: (dv: Derivazione[], fc: number) => void
}

function pianoPer(d: Derivazione, fc: number): Plan {
  const base = planFor('sinus', '', fc)
  const shape = base.shape ? { ...base.shape, p: P_MV * d.p, r: QRS_MV * d.qrs, t: T_SU_R * QRS_MV * d.qrs } : null
  return { ...base, shape, irregularity: 0 }
}

/** Da dove parte il primo battito perché la R cada sullo zero del periodo. */
function anticipoR(plan: Plan): number {
  if (!plan.shape) return 0
  // Sulla forma con la P piccola: in alto la P esofagea supera il QRS, e il
  // punto più alto non sarebbe la R.
  const punti = beatPoints({ ...plan.shape, p: 0.1, r: 1, t: 0.3 })
  let tR = 0
  let massimo = -Infinity
  for (const [t, v] of punti) if (v > massimo) (massimo = v), (tR = t)
  return tR
}

export function creaEcgEsofageo(dv: Derivazione[], fc: number): EcgEsofageo {
  const piani = dv.map((d) => pianoPer(d, fc))
  const da = -anticipoR(piani[0])
  const treni: BeatTrain[] = piani.map((p) => createBeatTrain(p, seeded('esofago'), da))
  const battiti: { beat: Beat; fine: number }[][] = piani.map(() => [])
  const fino = piani.map(() => da)
  let intervallo = piani[0].interval

  const at = (k: number, t: number): number => {
    const lista = battiti[k]
    if (!lista) return 0
    if (t + intervallo > fino[k]) {
      const nuovi = treni[k].upTo(t + 2 * intervallo)
      for (const b of nuovi) lista.push({ beat: b, fine: b.start + (b.points[b.points.length - 1]?.[0] ?? 0) })
      fino[k] = t + 2 * intervallo
    }
    while (lista.length && lista[0].fine < t - 2) lista.shift()
    let v = 0
    for (const { beat, fine } of lista) {
      if (beat.start > t) break
      if (fine >= t) v += beat.at(t - beat.start)
    }
    return v
  }

  const aggiorna = (nuove: Derivazione[], fcNuova: number) => {
    nuove.forEach((d, k) => treni[k]?.setPlan(pianoPer(d, fcNuova)))
    intervallo = 60 / Math.max(20, fcNuova)
  }

  return { at, aggiorna }
}

/**
 * L'attività del diaframma come la vede un elettrodo: un'interferenza fitta,
 * cinquanta-cento cicli al secondo, che si gonfia con l'EAdi. Deterministica
 * nel tempo, come tutto quello che si disegna.
 */
export function emg(t: number): number {
  const w = 2 * Math.PI
  return (
    (0.5 * Math.sin(w * 53 * t) + 0.3 * Math.sin(w * 71 * t + 1.1) + 0.2 * Math.sin(w * 97 * t + 2.3)) *
    (0.75 + 0.25 * Math.sin(w * 6.3 * t))
  )
}
