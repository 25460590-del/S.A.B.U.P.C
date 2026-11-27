import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  HeartPulse,
  Image as ImageIcon,
  Phone,
  QrCode,
  ShieldCheck,
  User,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { BupcLogo } from '../components/BupcLogo'
import { normalizarNombrePropio } from '../lib/nombres'
import { etiquetaAyudantia } from '../lib/permisos'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import { escucharFotoPerfil, guardarFotoPerfil } from '../services/fotosService'
import type { FotoPerfil, Usuario } from '../types'

interface CredencialDigitalPageProps {
  perfil: Usuario
  caraInicial?: 'anverso' | 'reverso'
}

function formatearHora24(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`
}

export function CredencialDigitalPage({
  perfil,
  caraInicial = 'anverso',
}: CredencialDigitalPageProps) {
  const [cara, setCara] = useState<'anverso' | 'reverso'>(caraInicial)
  const [foto, setFoto] = useState<FotoPerfil | null>(null)
  const [fotoLocalPreview, setFotoLocalPreview] = useState<string | null>(null)
  const [mostrandoOpcionesFoto, setMostrandoOpcionesFoto] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [horaActual, setHoraActual] = useState(() => formatearHora24(new Date()))
  const contenedorQrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cancelar = escucharFotoPerfil(
      perfil.uid,
      (datos) => {
        setFoto(datos)
        if (datos?.imagen_webp_base64) {
          setFotoLocalPreview(null)
        }
      },
      () => {
        // Foto de perfil opcional: si aún no existe o no puede leerse, mostrar avatar sin banner de error
        setFoto(null)
      },
    )
    return cancelar
  }, [perfil.uid])

  useEffect(() => {
    const id = window.setInterval(() => {
      setHoraActual(formatearHora24(new Date()))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const payloadQrCredencial = JSON.stringify({
    v: 1,
    tipo: 'credencial_bupc',
    uid: perfil.uid,
    cuenta: perfil.numero_cuenta,
    qr: perfil.qr_codigo_unico ?? perfil.uid,
  })

  async function manejarSeleccionFoto(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const archivo = input.files?.[0]
    if (!archivo) return

    setMostrandoOpcionesFoto(false)
    setSubiendoFoto(true)
    setAvisoFoto(null)
    setErrorFoto(null)
    try {
      const { dataUrl } = await guardarFotoPerfil(perfil.uid, archivo)
      setFotoLocalPreview(dataUrl)
      setAvisoFoto('Fotografía actualizada correctamente.')
    } catch (err) {
      const tieneCodigo = Boolean((err as { code?: string })?.code)
      setErrorFoto(!tieneCodigo && err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      // Limpiar siempre después de procesar para permitir reintentos sin invalidar la captura móvil
      input.value = ''
      setSubiendoFoto(false)
    }
  }

  const fotoMostrada = fotoLocalPreview ?? foto?.imagen_webp_base64 ?? null

  function descargarQrPng() {
    const canvas = contenedorQrRef.current?.querySelector('canvas')
    if (!canvas) return
    const enlace = document.createElement('a')
    enlace.href = canvas.toDataURL('image/png')
    enlace.download = `credencial-bupc-${perfil.numero_cuenta || perfil.uid}.png`
    enlace.click()
  }

  const telefonoLimpio = perfil.contacto_emergencia_telefono.replace(/[^\d+]/g, '')

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {cara === 'anverso' ? (
        <article className="tarjeta flex flex-col overflow-hidden">
          {/* Encabezado Verde UdeC con espacio exclusivo para el logo oficial BUPC */}
          <header className="flex items-center gap-3 border-b-3 border-naranja bg-udec px-4 py-4 text-white">
            <BupcLogo tamano="md" />
            <div>
              <p className="text-xs font-semibold text-white/85">Universidad de Colima</p>
              <h2 className="text-sm font-bold leading-snug">
                Brigada Universitaria de Protección Civil
              </h2>
            </div>
          </header>

          {/* Identidad del Brigadista */}
          <div className="flex flex-col items-center gap-4 p-5 text-center">
            <div className="relative">
              {fotoMostrada ? (
                <img
                  src={fotoMostrada}
                  alt={`Fotografía de ${nombreCompleto(perfil)}`}
                  className="h-24 w-24 rounded-full border-2 border-udec object-cover dark:border-activo-claro"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-udec bg-salvia text-udec-oscuro dark:border-activo-claro dark:bg-noche-campo dark:text-noche-tinta"
                  aria-label="Sin fotografía registrada"
                >
                  <User size={38} strokeWidth={2} />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setErrorFoto(null)
                  setAvisoFoto(null)
                  setMostrandoOpcionesFoto((v) => !v)
                }}
                disabled={subiendoFoto}
                aria-expanded={mostrandoOpcionesFoto}
                aria-label="Subir o cambiar fotografía de perfil"
                title="Subir o cambiar fotografía"
                className="absolute right-0 bottom-0 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-udec text-white hover:bg-udec-oscuro disabled:opacity-60 dark:border-noche-tarjeta"
              >
                <Camera size={16} strokeWidth={2} />
              </button>
            </div>

            {mostrandoOpcionesFoto && !subiendoFoto && (
              <div
                role="group"
                aria-label="Opciones para actualizar fotografía"
                className="grid w-full grid-cols-2 gap-2 rounded-xl border border-borde bg-superficie-suave p-2.5 dark:border-noche-borde dark:bg-noche-campo"
              >
                <label className="btn-verde min-h-10 cursor-pointer px-2.5 text-xs">
                  <Camera size={15} strokeWidth={2} />
                  <span>Tomar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => void manejarSeleccionFoto(e)}
                    className="sr-only"
                  />
                </label>

                <label className="btn-salvia min-h-10 cursor-pointer px-2.5 text-xs">
                  <ImageIcon size={15} strokeWidth={2} />
                  <span>Elegir de galería</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void manejarSeleccionFoto(e)}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            {subiendoFoto && (
              <p className="text-xs font-semibold text-udec dark:text-activo-claro">
                Guardando fotografía...
              </p>
            )}

            {avisoFoto && (
              <div
                role="status"
                className="flex w-full items-center gap-2 rounded-lg border border-activo bg-activo-suave px-3 py-2 text-left text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
              >
                <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
                <span>{avisoFoto}</span>
              </div>
            )}

            {errorFoto && (
              <div
                role="alert"
                className="flex w-full items-center gap-2 rounded-lg border border-alerta bg-alerta-suave px-3 py-2 text-left text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
              >
                <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
                <span>{errorFoto}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold text-tinta dark:text-noche-tinta">
                {nombreCompleto(perfil)}
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold tabular-nums">
                <span className="text-tinta-suave dark:text-noche-tinta-suave">
                  Cuenta: {perfil.numero_cuenta}
                </span>
                <span className="text-udec-oscuro dark:text-activo-claro">
                  Clave: {perfil.clave_radio || perfil.clave_personal_radio || 'Sin clave'}
                </span>
              </div>
            </div>

            {/* Badges simultáneos: Etapa/Grupo + Ayudantía (unificado) + Estatus */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-udec px-3 py-1 text-xs font-semibold text-white">
                {perfil.subgrupo || perfil.etapa}
              </span>
              <span className="badge-ayudantia px-3 py-1 text-xs">
                {etiquetaAyudantia(perfil.ayudantia)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-activo bg-activo-suave px-3 py-1 text-xs font-bold text-activo-texto dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro">
                <span className="h-2 w-2 rounded-full bg-activo dark:bg-activo-claro" />
                <span>ACTIVO</span>
              </span>
            </div>

            {/* Código QR SIEMPRE sobre fondo BLANCO PURO (#FFFFFF) con margen amplio */}
            <div className="flex w-full flex-col items-center gap-3 pt-1">
              <div
                ref={contenedorQrRef}
                className="flex items-center justify-center rounded-xl border border-borde-fuerte bg-[#FFFFFF] p-4"
              >
                <QRCodeCanvas
                  value={payloadQrCredencial}
                  size={188}
                  bgColor="#FFFFFF"
                  fgColor="#18181B"
                  level="M"
                  includeMargin
                />
              </div>

              {/* Reloj digital en vivo con segundos (24h, números tabulares) */}
              <div className="inline-flex items-center gap-2 rounded-full border border-borde bg-salvia px-4 py-1.5 dark:border-noche-borde dark:bg-noche-campo">
                <ShieldCheck
                  size={16}
                  strokeWidth={2}
                  className="text-activo dark:text-activo-claro"
                />
                <span className="text-sm font-bold tabular-nums text-udec-oscuro dark:text-noche-tinta">
                  {horaActual}
                </span>
              </div>
            </div>

            {/* Acciones: Descargar QR (salvia) y Ficha de Emergencia (naranja) */}
            <div className="grid w-full grid-cols-2 gap-2.5 pt-1">
              <button type="button" onClick={descargarQrPng} className="btn-salvia px-3 text-xs">
                <Download size={16} strokeWidth={2} />
                <span>Descargar QR</span>
              </button>
              <button
                type="button"
                onClick={() => setCara('reverso')}
                className="btn-naranja px-3 text-xs"
              >
                <HeartPulse size={16} strokeWidth={2} />
                <span>Ficha de Emergencia</span>
              </button>
            </div>
          </div>
        </article>
      ) : (
        /* REVERSO: Ficha de Emergencia */
        <article className="tarjeta flex flex-col overflow-hidden border-2 border-alerta">
          <header className="flex items-center gap-2.5 bg-alerta px-4 py-4 text-white">
            <HeartPulse size={22} strokeWidth={2} className="shrink-0" />
            <h2 className="text-sm font-bold tracking-wide">FICHA DE EMERGENCIA · BUPC</h2>
          </header>

          <div className="flex flex-col gap-4 p-5">
            {/* Tipo de sangre destacado */}
            <div className="flex items-center justify-between rounded-lg border border-alerta bg-alerta-suave p-4 dark:bg-noche-rojo-suave">
              <div>
                <span className="block text-xs font-semibold text-tinta dark:text-noche-tinta">
                  Tipo de sangre
                </span>
                <span className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Grupo y factor Rh
                </span>
              </div>
              <span className="text-3xl font-extrabold tabular-nums text-alerta dark:text-noche-rojo-texto">
                {perfil.tipo_sangre}
              </span>
            </div>

            {/* Alergias */}
            <div className="flex flex-col gap-1 border-b border-borde pb-3 dark:border-noche-borde">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Alergias conocidas
              </span>
              <p className="text-base font-semibold text-tinta dark:text-noche-tinta">
                {perfil.alergias || 'Ninguna'}
              </p>
            </div>

            {/* Condiciones y medicamentos */}
            <div className="flex flex-col gap-1 border-b border-borde pb-3 dark:border-noche-borde">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Condiciones y medicamentos actuales
              </span>
              <p className="text-sm text-tinta dark:text-noche-tinta">
                {perfil.padecimientos_medicamentos || 'Ninguno'}
              </p>
            </div>

            {/* Contacto de emergencia (3 campos diferenciados) */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold tracking-wide uppercase text-tinta-suave dark:text-noche-tinta-suave">
                Contacto de emergencia
              </span>
              <dl className="grid grid-cols-1 gap-2 rounded-lg bg-superficie-suave p-3 text-sm dark:bg-noche-campo">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Nombre
                  </dt>
                  <dd className="text-right font-bold text-tinta dark:text-noche-tinta">
                    {normalizarNombrePropio(perfil.contacto_emergencia_nombre)}
                  </dd>
                </div>
                {perfil.contacto_emergencia_parentesco && (
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                    <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Parentesco
                    </dt>
                    <dd className="text-right font-semibold text-tinta dark:text-noche-tinta">
                      {perfil.contacto_emergencia_parentesco}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Teléfono
                  </dt>
                  <dd className="text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
                    {telefonoLimpio ? (
                      <a
                        href={`tel:${telefonoLimpio}`}
                        className="text-alerta-texto underline decoration-alerta/60 underline-offset-2 dark:text-noche-rojo-texto"
                      >
                        {perfil.contacto_emergencia_telefono}
                      </a>
                    ) : (
                      perfil.contacto_emergencia_telefono
                    )}
                  </dd>
                </div>
              </dl>

              <a href={`tel:${telefonoLimpio}`} className="btn-rojo w-full">
                <Phone size={18} strokeWidth={2} />
                <span>Llamar a Emergencia</span>
              </a>
            </div>

            <p className="text-center text-[11px] leading-snug text-tinta-suave dark:text-noche-tinta-suave">
              Información declarada voluntariamente por el integrante únicamente como referencia en
              caso de emergencia.
            </p>

            <button
              type="button"
              onClick={() => setCara('anverso')}
              className="btn-salvia w-full"
            >
              <QrCode size={18} strokeWidth={2} />
              <span>Volver a la Credencial</span>
            </button>
          </div>
        </article>
      )}
    </div>
  )
}
