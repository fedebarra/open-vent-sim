/**
 * The ROX index for the instructor: (SpO₂ / FiO₂) / respiratory rate, on high
 * flow. Roca et al., Am J Respir Crit Care Med 2019 (doi:10.1164/rccm.201803-0589OC):
 * ROX ≥ 4.88 at 2, 6 or 12 h means a lower risk of intubation; below 2.85,
 * 3.47 and 3.85 at 2, 6 and 12 h it predicts failure. A console reference,
 * not a device number.
 */
export const ROX_SUCCESSO = 4.88;
export const ROX_FALLIMENTO = 2.85;

export function rox(spo2: number | null | undefined, fio2Percent: number | null | undefined, fr: number | null | undefined): number | null {
  if (typeof spo2 !== 'number' || typeof fio2Percent !== 'number' || typeof fr !== 'number') return null;
  if (!(fio2Percent > 0) || !(fr > 0)) return null;
  return spo2 / (fio2Percent / 100) / fr;
}

/** Green at or above the success cut-off, red below the earliest failure one, amber between. */
export function fasciaRox(v: number | null): 'basso' | 'incerto' | 'alto' | null {
  if (v === null) return null;
  if (v >= ROX_SUCCESSO) return 'basso';
  if (v < ROX_FALLIMENTO) return 'alto';
  return 'incerto';
}
