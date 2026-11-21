interface BupcLogoProps {
  tamano?: 'sm' | 'md' | 'lg'
  variante?: 'encabezado' | 'alerta'
}

/**
 * Espacio exclusivo reservado para el logotipo oficial de la BUPC.
 * Sin logotipos de ayudantías (regla institucional).
 * Se presenta sobre fondo blanco nítido para garantizar contraste en Modo Día y Modo Nocturno.
 */
export function BupcLogo({ tamano = 'md', variante = 'encabezado' }: BupcLogoProps) {
  const dimensiones = {
    sm: 'h-10 w-10 p-1',
    md: 'h-12 w-12 p-1',
    lg: 'h-20 w-20 p-1.5',
  }[tamano]

  const borde =
    variante === 'alerta'
      ? 'border-2 border-alerta bg-white'
      : 'border border-white/70 bg-white dark:border-noche-borde'

  return (
    <div
      className={`${dimensiones} ${borde} flex shrink-0 items-center justify-center overflow-hidden rounded-xl`}
      aria-label="Logotipo oficial de la Brigada Universitaria de Protección Civil (BUPC)"
    >
      <img
        src="/logo-bupc.png"
        alt="Logotipo oficial BUPC"
        className="h-full w-full object-contain"
        decoding="async"
      />
    </div>
  )
}
