import { forwardRef, useMemo } from 'react'

function hashCode(str) {
  let hash = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function isInFinder(r, c, size) {
  const inTL = r < 8 && c < 8
  const inTR = r < 8 && c >= size - 8
  const inBL = r >= size - 8 && c < 8
  return inTL || inTR || inBL
}

export const QrCodeSvg = forwardRef(function QrCodeSvg(
  { value = 'BUPC-UCOL-20214892', size = 184, label = 'Código QR' },
  ref
) {
  const grid = 21

  const dataCells = useMemo(() => {
    const cells = []
    let seed = hashCode(value)
    for (let r = 0; r < grid; r += 1) {
      for (let c = 0; c < grid; c += 1) {
        if (isInFinder(r, c, grid)) continue
        // Timing pattern
        if (r === 6 || c === 6) {
          if ((r + c) % 2 === 0) cells.push([c, r])
          continue
        }
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        if ((seed >>> 28) % 2 === 0) {
          cells.push([c, r])
        }
      }
    }
    return cells
  }, [value])

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${grid} ${grid}`}
      width={size}
      height={size}
      className="block"
      role="img"
      aria-label={label}
    >
      <rect width={grid} height={grid} fill="#FFFFFF" />
      {/* Finder Top-Left */}
      <path
        fill="#111827"
        d="M0,0 h7 v7 h-7 z M1,1 v5 h5 v-5 z M2,2 h3 v3 h-3 z"
      />
      {/* Finder Top-Right */}
      <path
        fill="#111827"
        d="M14,0 h7 v7 h-7 z M15,1 v5 h5 v-5 z M16,2 h3 v3 h-3 z"
      />
      {/* Finder Bottom-Left */}
      <path
        fill="#111827"
        d="M0,14 h7 v7 h-7 z M1,15 v5 h5 v-5 z M2,16 h3 v3 h-3 z"
      />
      {/* Data Modules */}
      {dataCells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111827" />
      ))}
    </svg>
  )
})

export function downloadQrAsPng(svgElement, filename, meta = {}) {
  if (!svgElement) return
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgElement)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 760
  const ctx = canvas.getContext('2d')

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()

  img.onload = () => {
    // Background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Institutional Header Bar
    ctx.fillStyle = '#3E6E28'
    ctx.fillRect(0, 0, canvas.width, 108)
    ctx.fillStyle = '#E65300'
    ctx.fillRect(0, 108, canvas.width, 6)

    // Header Text
    ctx.fillStyle = '#EAF2E4'
    ctx.font = '600 18px Montserrat, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('BUPC · UNIVERSIDAD DE COLIMA', canvas.width / 2, 42)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 26px Montserrat, sans-serif'
    ctx.fillText(meta.title || 'S.A.B.U.P.C.', canvas.width / 2, 82)

    // QR Code
    ctx.drawImage(img, 100, 152, 440, 440)

    // Code & subtitle
    ctx.fillStyle = '#111827'
    ctx.font = '700 24px Montserrat, sans-serif'
    ctx.fillText(meta.code || '', canvas.width / 2, 646)

    if (meta.subtitle) {
      ctx.fillStyle = '#4B5563'
      ctx.font = '500 18px Montserrat, sans-serif'
      ctx.fillText(meta.subtitle, canvas.width / 2, 684)
    }

    URL.revokeObjectURL(url)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = filename
    link.click()
  }

  img.src = url
}
