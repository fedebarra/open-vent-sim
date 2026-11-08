/**
 * La cartuccia e il canister: due oggetti, non due barre.
 *
 * ## Perché disegnarli
 *
 * Un anestesista guarda la finestrella del vaporizzatore mille volte al giorno
 * e non legge mai una percentuale: vede **fin dove arriva il liquido**, e nel
 * colore della ghiera sa già che agente è. La calce sodata è la stessa cosa
 * dall'altra parte: i granuli sono bianchi e virano al viola man mano che si
 * esauriscono, e virano **dal basso**, perché è da lì che passa il gas.
 *
 * Metterci due barre di avanzamento con la percentuale accanto sarebbe più
 * facile e insegnerebbe a guardare un posto che sulla macchina vera non esiste.
 * Il numero resta scritto di fianco — serve a chi deve dire un valore ad alta
 * voce — ma l'indicatore è l'oggetto.
 *
 * ## Muti
 *
 * Nessuna didascalia, nessun avviso, nessun colore che diventa rosso per dire
 * «attenzione». Una cartuccia quasi vuota si vede che è quasi vuota. Questa è
 * la decisione 7 del piano, ed è anche il motivo per cui il riempimento a gas
 * aperti non produce nessun messaggio: quello che il device non dice, lo dice il
 * debriefing.
 */

import { AGENTI, type Agente } from './gas'

/**
 * La cartuccia del vaporizzatore, con dentro il liquido dell'agente.
 *
 * Il livello scende da sotto la spalla verso il fondo, e sopra c'è la linea
 * chiara del pelo libero — è quella che si vede per prima guardando di
 * traverso. Le tacche a destra sono la scala della finestrella.
 */
export function Cartuccia({ agente, livello }: { agente: Agente; livello: number }) {
  const quota = Math.max(0, Math.min(1, livello))
  // La finestrella va da y=18 a y=90: 72 pixel di corsa.
  const altezza = 72 * quota
  const pelo = 90 - altezza
  const colore = AGENTI[agente].colore
  return (
    <svg
      className="simvent__cartuccia"
      width="56"
      height="104"
      viewBox="0 0 56 104"
      aria-hidden="true"
    >
      <rect x="18" y="0" width="20" height="10" rx="2" fill="#3a4356" />
      <rect x="8" y="10" width="40" height="88" rx="6" fill="#1b2333" stroke="#3a4356" strokeWidth="1.5" />
      <rect x="14" y="18" width="28" height="72" rx="3" fill="#0a0f1a" />
      {altezza > 0 && (
        <>
          <rect x="14" y={pelo} width="28" height={altezza} fill={colore} opacity="0.9" />
          <line x1="14" y1={pelo + 0.5} x2="42" y2={pelo + 0.5} stroke="#fde68a" strokeWidth="2" opacity="0.85" />
        </>
      )}
      <line x1="43" y1="26" x2="47" y2="26" stroke="#6f7c90" strokeWidth="1" />
      <line x1="43" y1="48" x2="47" y2="48" stroke="#6f7c90" strokeWidth="1" />
      <line x1="43" y1="70" x2="47" y2="70" stroke="#6f7c90" strokeWidth="1" />
    </svg>
  )
}

/**
 * Il canister della calce sodata, coi granuli che virano.
 *
 * Tre fasce: bianca in alto (calce buona), mista in mezzo (il fronte che
 * avanza), viola sotto (esaurita). La fascia mista è alta nove pixel e non è un
 * dettaglio grafico: sul canister vero il viraggio non è una riga netta, ed è
 * proprio la banda sfumata che si guarda per capire quanto manca.
 *
 * I motivi hanno un identificatore che porta dentro il nome del componente:
 * due canister sulla stessa pagina — la regia che ne mostra due — con lo stesso
 * `id` si ruberebbero il riempimento a vicenda.
 */
export function Canister({ residua, id = 'calce' }: { residua: number; id?: string }) {
  const quota = Math.max(0, Math.min(1, residua))
  // La camera va da y=14 a y=93: 79 pixel. La banda mista ne prende 9.
  const camera = 79
  const banda = 9
  const bianca = Math.max(0, (camera - banda) * quota)
  const yBanda = 14 + bianca
  const yViola = yBanda + banda
  const viola = Math.max(0, 93 - yViola)
  return (
    <svg
      className="simvent__canister"
      width="64"
      height="104"
      viewBox="0 0 64 104"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`${id}-bianchi`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="3" fill="#dfe5ee" />
        </pattern>
        <pattern id={`${id}-viola`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="3" fill="#a78bfa" />
        </pattern>
        <pattern id={`${id}-misti`} width="18" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="3" fill="#dfe5ee" />
          <circle cx="13.5" cy="4.5" r="3" fill="#a78bfa" />
        </pattern>
      </defs>
      <rect x="8" y="0" width="48" height="8" rx="3" fill="#3a4356" />
      <rect x="6" y="8" width="52" height="90" rx="8" fill="#141c2b" stroke="#3a4356" strokeWidth="1.5" />
      {bianca > 0 && <rect x="11" y="14" width="42" height={bianca} fill={`url(#${id}-bianchi)`} />}
      <rect x="11" y={yBanda} width="42" height={banda} fill={`url(#${id}-misti)`} />
      {viola > 0 && <rect x="11" y={yViola} width="42" height={viola} fill={`url(#${id}-viola)`} />}
    </svg>
  )
}

/**
 * La camera dell'acqua dell'alto flusso.
 *
 * Stessa idea, oggetto diverso: una camera trasparente con dentro l'acqua e il
 * pelo libero. Non c'è un colore d'agente da rispettare — l'acqua è acqua — e
 * la scala è quella che sta stampata sulla camera vera.
 */
export function CameraAcqua({ livello }: { livello: number }) {
  const quota = Math.max(0, Math.min(1, livello))
  const altezza = 66 * quota
  const pelo = 88 - altezza
  return (
    <svg
      className="simvent__camera"
      width="64"
      height="104"
      viewBox="0 0 64 104"
      aria-hidden="true"
    >
      <rect x="20" y="0" width="24" height="10" rx="2" fill="#3a4356" />
      <rect x="10" y="10" width="44" height="86" rx="7" fill="#141c2b" stroke="#3a4356" strokeWidth="1.5" />
      <rect x="16" y="22" width="32" height="66" rx="3" fill="#0a0f1a" />
      {altezza > 0 && (
        <>
          <rect x="16" y={pelo} width="32" height={altezza} fill="#38bdf8" opacity="0.55" />
          <line x1="16" y1={pelo + 0.5} x2="48" y2={pelo + 0.5} stroke="#bae6fd" strokeWidth="2" opacity="0.9" />
        </>
      )}
      <line x1="49" y1="38" x2="53" y2="38" stroke="#6f7c90" strokeWidth="1" />
      <line x1="49" y1="55" x2="53" y2="55" stroke="#6f7c90" strokeWidth="1" />
      <line x1="49" y1="72" x2="53" y2="72" stroke="#6f7c90" strokeWidth="1" />
    </svg>
  )
}
