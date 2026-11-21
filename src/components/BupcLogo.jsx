import { Shield } from 'lucide-react'

export function BupcLogo({ size = 'md' }) {
  const dims = {
    sm: 'w-10 h-10',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size]

  const iconSize = {
    sm: 20,
    md: 22,
    lg: 30,
    xl: 44,
  }[size]

  return (
    <div
      className={`${dims} rounded-full bg-[#FFFFFF] border-2 border-[#C8DDB9] flex items-center justify-center shrink-0 relative`}
      aria-label="Escudo BUPC Universidad de Colima"
    >
      <Shield
        size={iconSize}
        strokeWidth={2}
        className="text-[#3E6E28] fill-[#EAF2E4]"
      />
      <span
        className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#E65300] border border-[#FFFFFF]"
        aria-hidden="true"
      />
    </div>
  )
}
