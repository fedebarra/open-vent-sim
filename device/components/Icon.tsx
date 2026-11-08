/** The two interface icons the ventilator uses — original Open Vent Sim drawings. */
import type { SVGProps } from 'react'

type Name = 'close' | 'fullscreen'
const PATHS: Record<Name, string> = {
  close: 'M6 6l12 12M18 6L6 18',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
}

export function Icon({ name, size = 20, ...rest }: { name: Name; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  )
}
