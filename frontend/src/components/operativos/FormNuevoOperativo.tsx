import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CATEGORIAS_OPERATIVO } from '../../constants/catalogos'
import type { DatosNuevoOperativo } from '../../services/operativosService'
import type { CategoriaOperativo, ModoQrOperativo } from '../../types'
import { valorDatetimeLocalActual } from './helpers'

interface FormNuevoOperativoProps {
  guardando: boolean
  alEnviar: (datos: DatosNuevoOperativo) => Promise<void>
  alErrorValidacion: (mensaje: string) => void
  alCancelar: () => void
}

export function FormNuevoOperativo({
  guardando,
  alEnviar,
  alErrorValidacion,
  alCancelar,
}: FormNuevoOperativoProps) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState<CategoriaOperativo>('Operativos Masivos')
  const [sede, setSede] = useState('')
  const [fechaInicio, setFechaInicio] = useState(valorDatetimeLocalActual)
  const [fechaFin, setFechaFin] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modoQrInicial, setModoQrInicial] = useState<ModoQrOperativo>('dinamico')
  const [recepcionInicial, setRecepcionInicial] = useState(true)
  const [convocatoriaInicial, setConvocatoriaInicial] = useState(false)
  const [cupoInicial, setCupoInicial] = useState('')

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()

    if (!nombre.trim()) return alErrorValidacion('Ingresa el nombre del operativo o actividad.')
    if (!sede.trim()) return alErrorValidacion('Ingresa la sede o ubicación.')
    if (!fechaInicio.trim()) return alErrorValidacion('Selecciona la fecha y hora de inicio.')

    const cupoNum = cupoInicial.trim() ? Number(cupoInicial.trim()) : null
    if (cupoNum !== null && (!Number.isInteger(cupoNum) || cupoNum < 1 || cupoNum > 1000)) {
      return alErrorValidacion('El cupo sugerido debe ser un número entero entre 1 y 1000.')
    }

    await alEnviar({
      nombre,
      categoria,
      sede,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      descripcion,
      modo_qr: modoQrInicial,
      recepcion_abierta: recepcionInicial,
      convocatoria_abierta: convocatoriaInicial,
      cupo_sugerido: cupoNum,
    })
  }

  return (
    <article className="tarjeta flex flex-col gap-4 border-2 border-udec p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
        <div>
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Iniciar Nuevo Operativo o Actividad
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Configura el pase de lista con código QR fijo o dinámico.
          </p>
        </div>
        <button
          type="button"
          onClick={alCancelar}
          aria-label="Cerrar formulario"
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-borde text-tinta-suave hover:text-tinta dark:border-noche-borde dark:text-noche-tinta-suave"
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>

      <form onSubmit={(e) => void manejarSubmit(e)} className="flex flex-col gap-3.5" noValidate>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="op-nombre" className="etiqueta">
              Nombre del operativo
            </label>
            <input
              id="op-nombre"
              type="text"
              maxLength={120}
              placeholder="Ej. Loromanía 2026 / Guardia Matutina"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="op-categoria" className="etiqueta">
              Categoría
            </label>
            <select
              id="op-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaOperativo)}
              className="campo"
            >
              {CATEGORIAS_OPERATIVO.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="op-sede" className="etiqueta">
              Sede / Ubicación
            </label>
            <input
              id="op-sede"
              type="text"
              maxLength={120}
              placeholder="Ej. Campus Central / Base CECOM"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              className="campo"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="op-modo" className="etiqueta">
              Modo de QR inicial
            </label>
            <select
              id="op-modo"
              value={modoQrInicial}
              onChange={(e) => setModoQrInicial(e.target.value as ModoQrOperativo)}
              className="campo"
            >
              <option value="dinamico">QR Dinámico (se renueva cada 30 s)</option>
              <option value="estatico">QR Fijo (para imprimir o proyectar)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="op-inicio" className="etiqueta">
              Fecha y hora de inicio
            </label>
            <input
              id="op-inicio"
              type="datetime-local"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="campo tabular-nums"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="op-fin" className="etiqueta">
              Fecha y hora de cierre (opcional)
            </label>
            <input
              id="op-fin"
              type="datetime-local"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="campo tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="op-desc" className="etiqueta">
            Indicaciones operativas (opcional)
          </label>
          <textarea
            id="op-desc"
            rows={2}
            maxLength={500}
            placeholder="Punto de reunión, uniforme o equipo requerido"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="campo min-h-20 py-2"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
            <input
              type="checkbox"
              checked={recepcionInicial}
              onChange={(e) => setRecepcionInicial(e.target.checked)}
              className="h-4 w-4 rounded accent-udec"
            />
            <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
              Abrir recepción de asistencias inmediatamente
            </span>
          </label>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
            <input
              type="checkbox"
              checked={convocatoriaInicial}
              onChange={(e) => setConvocatoriaInicial(e.target.checked)}
              className="h-4 w-4 rounded accent-udec"
            />
            <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
              Convocatoria abierta (permitir prerregistro previo)
            </span>
          </label>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="op-cupo" className="etiqueta">
              Cupo sugerido (opcional)
            </label>
            <input
              id="op-cupo"
              type="number"
              min={1}
              max={1000}
              placeholder="Sin límite"
              value={cupoInicial}
              onChange={(e) => setCupoInicial(e.target.value)}
              className="campo max-w-xs tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={alCancelar} disabled={guardando} className="btn-salvia">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-verde">
            {guardando ? 'Guardando...' : 'Crear Operativo'}
          </button>
        </div>
      </form>
    </article>
  )
}
