const CONECTORES_MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

function capitalizarSegmento(segmento: string): string {
  if (!segmento) return ''
  return segmento.charAt(0).toLocaleUpperCase('es-MX') + segmento.slice(1)
}

/**
 * Normaliza nombres propios en español a formato Tipo Título:
 * - Limpia espacios en los bordes y colapsa espacios duplicados.
 * - Respeta acentos y `ñ`.
 * - Mantiene en minúscula conectores cortos en medio del nombre (`de`, `del`, `la`, `las`, `los`, `y`).
 */
export function normalizarNombrePropio(texto?: string | null): string {
  if (!texto) return ''
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (!limpio) return ''

  return limpio
    .split(' ')
    .map((palabra, indice) => {
      const minuscula = palabra.toLocaleLowerCase('es-MX')
      if (indice > 0 && CONECTORES_MINUSCULA.has(minuscula)) {
        return minuscula
      }
      return minuscula
        .split('-')
        .map((seg) => capitalizarSegmento(seg))
        .join('-')
    })
    .join(' ')
}

/**
 * Normaliza etiquetas cortas como parentesco (ej. "MADRE" → "Madre", "hermano(a)" → "Hermano(a)").
 */
export function normalizarParentesco(texto?: string | null): string {
  if (!texto) return ''
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (!limpio) return ''
  const minuscula = limpio.toLocaleLowerCase('es-MX')
  return capitalizarSegmento(minuscula)
}

/**
 * Valida que un teléfono tenga al menos 10 dígitos numéricos (formato estándar en México).
 */
export function esTelefonoValido(telefono: string): boolean {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.length >= 10 && digitos.length <= 15
}
