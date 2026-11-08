/**
 * L'orologio degli apparecchi in aula: **l'ora della storia**, non quella del browser.
 *
 * Decisione dell'utente del 12 ottobre 2026: in aula un orologio solo. I referti
 * stampano l'ora dello scenario (`scenarios.sim_datetime`) e gli esami chiesti in
 * sessione la stessa più il tempo trascorso; il monitor mostrava invece l'ora del
 * tablet — «12 Oct 11:52» sul vetro accanto a un emogas «26/09 08:05».
 *
 * L'ora dello scenario è un'ora **a muro**: «08:04» vuol dire 08:04 dovunque sia
 * il tablet. Per questo si costruisce dai suoi numeri e non da `Date.parse`, che
 * leggendo il `+00:00` del server la sposterebbe nel fuso del browser.
 */

/** L'istante d'inizio della storia, nel fuso del browser ma con l'ora a muro giusta. */
export function inizioDellaStoria(iso?: string | null): number | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso)
  if (!m) return null
  const [, a, me, g, h, mi, s] = m
  return new Date(+a, +me - 1, +g, +h, +mi, +(s ?? 0)).getTime()
}

/**
 * Che ore sono per gli apparecchi, all'istante `adesso` (epoch del browser).
 *
 * L'inizio della storia più il tempo da `startedAt`; prima dell'avvio, l'inizio.
 * Senza un'ora di scenario — fuori da una sessione, istantanee vecchie — è
 * l'orologio del browser, com'era.
 */
export function oraDegliApparecchi(
  adesso: number,
  startedAt: number | null | undefined,
  oraScenario: string | null | undefined,
): Date {
  const inizio = inizioDellaStoria(oraScenario)
  if (inizio === null) return new Date(adesso)
  const trascorso = startedAt && startedAt > 0 ? Math.max(0, adesso - startedAt) : 0
  return new Date(inizio + trascorso)
}

/**
 * L'orologio della sessione aperta in questa pagina.
 *
 * Lo imposta chi riceve l'istantanea (il monitor, la regia); lo leggono gli
 * apparecchi — ventilatore, ECMO, BIS — che si ridisegnano ogni secondo da sé e
 * non hanno l'istantanea in mano. Una pagina è una sessione sola, quindi uno
 * stato di modulo basta, e risparmia un contesto attorno ai dieci rami di
 * `MonitorScreen`.
 */
let sessione: { startedAt?: number; oraScenario?: string } = {}

export function impostaOrologioDellAula(
  startedAt: number | null | undefined,
  oraScenario: string | null | undefined,
): void {
  sessione = { startedAt: startedAt ?? undefined, oraScenario: oraScenario ?? undefined }
}

/** L'ora che mostrano gli apparecchi all'istante `epoch` del browser. */
export function oraDellAula(epoch: number): Date {
  return oraDegliApparecchi(epoch, sessione.startedAt, sessione.oraScenario)
}
