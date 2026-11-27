import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FolderArchive,
  HeartPulse,
  History,
  IdCard,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  Pencil,
  Phone,
  Radio,
  Save,
  Shield,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import { CatalogosAuditoriaTab } from '../components/CatalogosAuditoriaTab'
import { GestionTeslaPanel } from '../components/GestionTeslaPanel'
import { IncidenciasPersonalPanel } from '../components/IncidenciasPersonalPanel'
import { MiMaterialPanel } from '../components/MiMaterialPanel'
import { ResguardoGlobalPanel } from '../components/ResguardoGlobalPanel'
import { TIPOS_SANGRE } from '../constants/catalogos'
import { useTema } from '../context/TemaContext'
import { esTelefonoValido, normalizarNombrePropio } from '../lib/nombres'
import {
  ayudantiaJefatura,
  esAdmin,
  esEncargado,
  esEncargadoTesla,
  etiquetaAyudantia,
  puedeUsarRadio,
} from '../lib/permisos'
import {
  actualizarFichaEmergenciaPropia,
  actualizarTelefonoPropio,
  cerrarSesion,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import { escucharFotoPerfil } from '../services/fotosService'
import type { FotoPerfil, TipoSangre, Usuario } from '../types'
import { AdminConsolePage } from './AdminConsolePage'
import { BrigadistaDashboardPage } from './BrigadistaDashboardPage'
import { CredencialDigitalPage } from './CredencialDigitalPage'
import { HistorialDualPage } from './HistorialDualPage'
import { OperativosPanelPage } from './OperativosPanelPage'
import { RadioConsolePage } from './RadioConsolePage'

interface PanelActivoPageProps {
  perfil: Usuario
}

type DestinoNavegacion =
  | 'credencial'
  | 'escaner'
  | 'material'
  | 'mi-historial'
  | 'operativos'
  | 'resguardo'
  | 'radio'
  | 'personal'
  | 'tesla'
  | 'incidencias'
  | 'archivo'
  | 'catalogos'
  | 'perfil'

type GrupoId = 'mi_espacio' | 'operacion' | 'gestion'

interface ItemMenu {
  id: DestinoNavegacion
  etiqueta: string
  icono: ReactNode
}

interface GrupoMenu {
  id: GrupoId
  titulo: string
  items: ItemMenu[]
}

const TITULOS_DESTINO: Record<DestinoNavegacion, string> = {
  credencial: 'Mi Credencial QR',
  escaner: 'Mi Turno',
  material: 'Mi Material',
  'mi-historial': 'Mi Historial',
  operativos: 'Mando Operativo',
  resguardo: 'Resguardo Global de Material',
  radio: 'Consola de Radio',
  personal: 'Personal',
  tesla: 'Claves TESLA',
  incidencias: 'Incidencias',
  archivo: 'Archivo Operativo Global',
  catalogos: 'Catálogos y Auditoría',
  perfil: 'Mi Perfil',
}

function FichaEmergenciaPerfilCard({ perfil }: { perfil: Usuario }) {
  const [editando, setEditando] = useState(false)
  const [tipoSangre, setTipoSangre] = useState<TipoSangre>(perfil.tipo_sangre)
  const [alergias, setAlergias] = useState(perfil.alergias || '')
  const [padecimientos, setPadecimientos] = useState(perfil.padecimientos_medicamentos || '')
  const [contactoNombre, setContactoNombre] = useState(
    normalizarNombrePropio(perfil.contacto_emergencia_nombre),
  )
  const [contactoParentesco, setContactoParentesco] = useState(
    perfil.contacto_emergencia_parentesco ?? '',
  )
  const [contactoTelefono, setContactoTelefono] = useState(perfil.contacto_emergencia_telefono)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function abrirEdicion() {
    setTipoSangre(perfil.tipo_sangre)
    setAlergias(perfil.alergias || '')
    setPadecimientos(perfil.padecimientos_medicamentos || '')
    setContactoNombre(normalizarNombrePropio(perfil.contacto_emergencia_nombre))
    setContactoParentesco(perfil.contacto_emergencia_parentesco ?? '')
    setContactoTelefono(perfil.contacto_emergencia_telefono)
    setError(null)
    setAviso(null)
    setEditando(true)
  }

  async function manejarGuardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!contactoNombre.trim()) {
      setError('Ingresa el nombre del contacto de emergencia.')
      return
    }
    if (!contactoParentesco.trim()) {
      setError('Ingresa el parentesco del contacto de emergencia.')
      return
    }
    if (!esTelefonoValido(contactoTelefono)) {
      setError('Ingresa un teléfono de emergencia válido de al menos 10 dígitos.')
      return
    }

    setGuardando(true)
    try {
      await actualizarFichaEmergenciaPropia(perfil.uid, {
        tipo_sangre: tipoSangre,
        alergias,
        padecimientos_medicamentos: padecimientos,
        contacto_emergencia_nombre: contactoNombre,
        contacto_emergencia_parentesco: contactoParentesco,
        contacto_emergencia_telefono: contactoTelefono,
      })
      setAviso('Ficha de Emergencia actualizada correctamente.')
      setEditando(false)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <article className="tarjeta mx-auto flex w-full max-w-md flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
        <div className="flex items-center gap-2">
          <HeartPulse size={18} strokeWidth={2} className="text-alerta dark:text-noche-rojo-texto" />
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Ficha de Emergencia
          </h3>
        </div>
        {!editando && (
          <button
            type="button"
            onClick={abrirEdicion}
            className="btn-salvia min-h-8 px-3 text-xs"
          >
            {perfil.contacto_emergencia_parentesco ? 'Editar' : 'Completar'}
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-2.5 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {editando ? (
        <form onSubmit={manejarGuardar} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="perf-sangre" className="etiqueta">
              Tipo de sangre
            </label>
            <select
              id="perf-sangre"
              value={tipoSangre}
              onChange={(e) => setTipoSangre(e.target.value as TipoSangre)}
              className="campo text-sm font-bold tabular-nums"
            >
              {TIPOS_SANGRE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perf-emerg-nom" className="etiqueta">
              Nombre del contacto de emergencia
            </label>
            <input
              id="perf-emerg-nom"
              type="text"
              maxLength={120}
              placeholder="Nombre completo"
              value={contactoNombre}
              onChange={(e) => setContactoNombre(e.target.value)}
              className="campo text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perf-emerg-par" className="etiqueta">
              Parentesco
            </label>
            <input
              id="perf-emerg-par"
              type="text"
              maxLength={60}
              placeholder="Ej. Madre, Padre, Hermano(a), Pareja"
              value={contactoParentesco}
              onChange={(e) => setContactoParentesco(e.target.value)}
              className="campo text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perf-emerg-tel" className="etiqueta">
              Teléfono de emergencia
            </label>
            <input
              id="perf-emerg-tel"
              type="tel"
              maxLength={20}
              placeholder="10 dígitos"
              value={contactoTelefono}
              onChange={(e) => setContactoTelefono(e.target.value)}
              className="campo text-sm tabular-nums"
              required
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-borde pt-2.5 dark:border-noche-borde">
            <label htmlFor="perf-alergias" className="etiqueta">
              Alergias
            </label>
            <input
              id="perf-alergias"
              type="text"
              maxLength={300}
              placeholder="Ej. Penicilina, látex o Ninguna"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              className="campo text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perf-padec" className="etiqueta">
              Condiciones / medicamentos actuales
            </label>
            <textarea
              id="perf-padec"
              rows={2}
              maxLength={500}
              placeholder="Condiciones relevantes o medicamentos actuales (o Ninguno)"
              value={padecimientos}
              onChange={(e) => setPadecimientos(e.target.value)}
              className="campo min-h-18 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={guardando}
              onClick={() => setEditando(false)}
              className="btn-salvia min-h-9 px-3 text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-verde min-h-9 px-4 text-xs">
              <Save size={14} strokeWidth={2} />
              <span>{guardando ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </form>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Tipo de sangre
            </dt>
            <dd className="font-bold tabular-nums text-alerta dark:text-noche-rojo-texto">
              {perfil.tipo_sangre}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Alergias
            </dt>
            <dd className="text-right text-xs font-semibold text-tinta dark:text-noche-tinta">
              {perfil.alergias || 'Ninguna'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Condiciones / medicamentos
            </dt>
            <dd className="text-right text-xs font-medium text-tinta dark:text-noche-tinta">
              {perfil.padecimientos_medicamentos || 'Ninguno'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Contacto de emergencia
            </dt>
            <dd className="text-right text-xs font-bold text-tinta dark:text-noche-tinta">
              {normalizarNombrePropio(perfil.contacto_emergencia_nombre)}
            </dd>
          </div>
          {perfil.contacto_emergencia_parentesco && (
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Parentesco
              </dt>
              <dd className="text-right text-xs font-semibold text-tinta dark:text-noche-tinta">
                {perfil.contacto_emergencia_parentesco}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Teléfono de emergencia
            </dt>
            <dd className="text-right text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
              {perfil.contacto_emergencia_telefono}
            </dd>
          </div>
        </dl>
      )}

      <p className="border-t border-borde pt-2.5 text-[11px] leading-snug text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
        Información declarada voluntariamente por el integrante únicamente como referencia en caso
        de emergencia.
      </p>
    </article>
  )
}

function TelefonoPropioPerfilCard({ perfil }: { perfil: Usuario }) {
  const [editando, setEditando] = useState(false)
  const [celular, setCelular] = useState(perfil.celular)
  const [conWhatsapp, setConWhatsapp] = useState(perfil.celular_con_whatsapp)
  const [telefonoFijo, setTelefonoFijo] = useState(perfil.telefono_fijo || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function abrirEdicion() {
    setCelular(perfil.celular)
    setConWhatsapp(perfil.celular_con_whatsapp)
    setTelefonoFijo(perfil.telefono_fijo || '')
    setError(null)
    setAviso(null)
    setEditando(true)
  }

  async function manejarGuardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!esTelefonoValido(celular)) {
      setError('Ingresa un número de celular válido de al menos 10 dígitos.')
      return
    }
    if (telefonoFijo.trim() && !esTelefonoValido(telefonoFijo)) {
      setError('El teléfono fijo debe tener al menos 10 dígitos o dejarse vacío.')
      return
    }

    setGuardando(true)
    try {
      await actualizarTelefonoPropio(perfil.uid, {
        celular,
        celular_con_whatsapp: conWhatsapp,
        telefono_fijo: telefonoFijo,
      })
      setAviso('Teléfono propio actualizado correctamente.')
      setEditando(false)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <article className="tarjeta mx-auto flex w-full max-w-md flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
        <div className="flex items-center gap-2">
          <Phone size={17} strokeWidth={2} className="text-udec dark:text-activo-claro" />
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Teléfono de Contacto
          </h3>
        </div>
        {!editando && (
          <button
            type="button"
            onClick={abrirEdicion}
            className="btn-salvia min-h-8 px-3 text-xs"
          >
            <Pencil size={13} strokeWidth={2} />
            <span>Editar</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-2.5 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {editando ? (
        <form onSubmit={manejarGuardar} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="perf-cel" className="etiqueta">
              Celular
            </label>
            <input
              id="perf-cel"
              type="tel"
              maxLength={20}
              placeholder="10 dígitos"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="campo text-sm tabular-nums"
              required
            />
          </div>

          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
            <input
              type="checkbox"
              checked={conWhatsapp}
              onChange={(e) => setConWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded accent-udec"
            />
            <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
              Este celular tiene WhatsApp activo
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <label htmlFor="perf-fijo" className="etiqueta">
              Teléfono fijo (opcional)
            </label>
            <input
              id="perf-fijo"
              type="tel"
              maxLength={20}
              placeholder="Opcional"
              value={telefonoFijo}
              onChange={(e) => setTelefonoFijo(e.target.value)}
              className="campo text-sm tabular-nums"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={guardando}
              onClick={() => setEditando(false)}
              className="btn-salvia min-h-9 px-3 text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-verde min-h-9 px-4 text-xs">
              <Save size={14} strokeWidth={2} />
              <span>{guardando ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </form>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Celular
            </dt>
            <dd className="font-bold tabular-nums text-tinta dark:text-noche-tinta">
              {perfil.celular}
              {perfil.celular_con_whatsapp ? ' (WhatsApp)' : ''}
            </dd>
          </div>
          {perfil.telefono_fijo && (
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Teléfono fijo
              </dt>
              <dd className="font-semibold tabular-nums text-tinta dark:text-noche-tinta">
                {perfil.telefono_fijo}
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  )
}

/**
 * Shell operativo unificado y responsive (PC + Móvil) con RBAC estrictamente aditivo:
 * Brigadista ⊂ Encargado ⊂ Administrador.
 */
export function PanelActivoPage({ perfil }: PanelActivoPageProps) {
  const { esOscuro, alternarTema } = useTema()

  const soyAdmin = esAdmin(perfil)
  const soyEncargado = esEncargado(perfil)
  const ayJefe = ayudantiaJefatura(perfil)
  const soyJefeAyudantia = Boolean(ayJefe)
  const soyTesla = esEncargadoTesla(perfil)
  const puedoRadio = puedeUsarRadio(perfil)
  const tengoGruposACargo = (perfil.grupos_a_cargo?.length ?? 0) > 0
  const puedoPersonal = soyAdmin || soyJefeAyudantia || (soyEncargado && tengoGruposACargo)

  const esMovilInicial = typeof window !== 'undefined' && window.innerWidth < 1024
  const destinoInicial: DestinoNavegacion = esMovilInicial
    ? soyEncargado
      ? 'operativos'
      : 'escaner'
    : soyAdmin
      ? 'personal'
      : soyJefeAyudantia
        ? 'personal'
        : soyEncargado
          ? 'operativos'
          : 'escaner'

  const [destino, setDestino] = useState<DestinoNavegacion>(destinoInicial)
  const [credencialCaraInicial, setCredencialCaraInicial] = useState<'anverso' | 'reverso'>(
    'anverso',
  )
  const [credencialClave, setCredencialClave] = useState(0)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [fotoPropia, setFotoPropia] = useState<FotoPerfil | null>(null)
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<GrupoId, boolean>>({
    mi_espacio: true,
    operacion: soyEncargado || puedoRadio,
    gestion: soyAdmin || soyJefeAyudantia || soyTesla || tengoGruposACargo,
  })

  useEffect(() => {
    const cancelarFoto = escucharFotoPerfil(
      perfil.uid,
      setFotoPropia,
      () => setFotoPropia(null),
    )
    return cancelarFoto
  }, [perfil.uid])

  useEffect(() => {
    const alConectar = () => setEnLinea(true)
    const alDesconectar = () => setEnLinea(false)
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  }, [])

  // Construcción de secciones lógicas según permisos aditivos
  const gruposMenu: GrupoMenu[] = [
    {
      id: 'mi_espacio',
      titulo: 'Mi Espacio',
      items: [
        { id: 'credencial', etiqueta: 'Mi Credencial QR', icono: <IdCard size={17} strokeWidth={2} /> },
        { id: 'escaner', etiqueta: 'Mi Turno', icono: <CalendarCheck size={17} strokeWidth={2} /> },
        { id: 'material', etiqueta: 'Mi Material', icono: <Package size={17} strokeWidth={2} /> },
        { id: 'mi-historial', etiqueta: 'Mi Historial', icono: <History size={17} strokeWidth={2} /> },
      ],
    },
  ]

  const itemsOperacion: ItemMenu[] = []
  if (soyEncargado) {
    itemsOperacion.push(
      { id: 'operativos', etiqueta: 'Mando Operativo', icono: <Megaphone size={17} strokeWidth={2} /> },
      { id: 'resguardo', etiqueta: 'Resguardo Global', icono: <Package size={17} strokeWidth={2} /> },
    )
  }
  if (puedoRadio) {
    itemsOperacion.push({
      id: 'radio',
      etiqueta: 'Consola de Radio',
      icono: <Radio size={17} strokeWidth={2} />,
    })
  }
  if (itemsOperacion.length > 0) {
    gruposMenu.push({ id: 'operacion', titulo: 'Operación', items: itemsOperacion })
  }

  const itemsGestion: ItemMenu[] = []
  if (puedoPersonal) {
    itemsGestion.push({
      id: 'personal',
      etiqueta: soyAdmin
        ? 'Admin. de Personal'
        : ayJefe
          ? `Mi Ayudantía (${ayJefe})`
          : 'Mi Personal',
      icono: soyAdmin ? <UserCheck size={17} strokeWidth={2} /> : <Users size={17} strokeWidth={2} />,
    })
  }
  if (soyTesla) {
    itemsGestion.push({
      id: 'tesla',
      etiqueta: 'Claves TESLA',
      icono: <KeyRound size={17} strokeWidth={2} />,
    })
  }
  if (soyEncargado) {
    itemsGestion.push(
      { id: 'incidencias', etiqueta: 'Incidencias', icono: <ClipboardList size={17} strokeWidth={2} /> },
      { id: 'archivo', etiqueta: 'Archivo Global', icono: <FolderArchive size={17} strokeWidth={2} /> },
    )
  }
  if (soyAdmin) {
    itemsGestion.push({
      id: 'catalogos',
      etiqueta: 'Catálogos y Auditoría',
      icono: <Database size={17} strokeWidth={2} />,
    })
  }
  if (itemsGestion.length > 0) {
    gruposMenu.push({ id: 'gestion', titulo: 'Personal y Gestión', items: itemsGestion })
  }

  function seleccionarDestino(nuevo: DestinoNavegacion) {
    if (nuevo === 'credencial') {
      setCredencialCaraInicial('anverso')
      setCredencialClave((k) => k + 1)
    }
    setDestino(nuevo)
    setDrawerAbierto(false)
  }

  function abrirFichaEmergenciaDirecta() {
    setCredencialCaraInicial('reverso')
    setCredencialClave((k) => k + 1)
    setDestino('credencial')
    setDrawerAbierto(false)
  }

  function alternarGrupo(id: GrupoId) {
    setGruposAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function renderListaNavegacion() {
    return (
      <nav aria-label="Menú principal" className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {gruposMenu.map((grupo) => {
          const abierto = gruposAbiertos[grupo.id]
          const contieneActivo = grupo.items.some((i) => i.id === destino)
          return (
            <div key={grupo.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => alternarGrupo(grupo.id)}
                aria-expanded={abierto}
                className={`flex min-h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  contieneActivo
                    ? 'text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white dark:text-noche-tinta-suave'
                }`}
              >
                <span>{grupo.titulo}</span>
                {abierto ? <ChevronDown size={14} strokeWidth={2.2} /> : <ChevronRight size={14} strokeWidth={2.2} />}
              </button>

              {abierto && (
                <div className="flex flex-col gap-0.5 pl-1">
                  {grupo.items.map((item) => {
                    const activo = destino === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => seleccionarDestino(item.id)}
                        className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${
                          activo
                            ? 'bg-white/15 text-white dark:bg-udec'
                            : 'text-white/80 hover:bg-white/10 hover:text-white dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
                        }`}
                      >
                        <span className="shrink-0">{item.icono}</span>
                        <span className="truncate">{item.etiqueta}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    )
  }

  function renderPiePerfil() {
    return (
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-white/15 pt-3 dark:border-noche-borde">
        <button
          type="button"
          onClick={() => seleccionarDestino('perfil')}
          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg p-2 text-left transition-colors ${
            destino === 'perfil'
              ? 'bg-white/15 text-white dark:bg-udec'
              : 'hover:bg-white/10 dark:hover:bg-noche-tarjeta'
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {fotoPropia?.imagen_webp_base64 && (
              <img
                src={fotoPropia.imagen_webp_base64}
                alt={nombreCompleto(perfil)}
                className="h-8 w-8 shrink-0 rounded-full border border-white/40 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-white">
                {nombreCompleto(perfil)}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/75 dark:text-noche-tinta-suave">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    enLinea ? 'bg-activo-claro' : 'bg-ambar'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {ayJefe
                    ? `Jefe · ${ayJefe}`
                    : `${perfil.rol_sistema}${perfil.ayudantia !== 'Ninguna' ? ` · ${perfil.ayudantia}` : ''}`}
                </span>
              </span>
            </div>
          </div>
          <Shield size={15} strokeWidth={2} className="shrink-0 text-white/70" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={alternarTema}
            aria-label={esOscuro ? 'Cambiar a modo día' : 'Cambiar a modo nocturno'}
            className="btn min-h-9 flex-1 border border-white/20 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 dark:border-noche-borde dark:bg-noche-tarjeta"
          >
            {esOscuro ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
            <span>{esOscuro ? 'Día' : 'Nocturno'}</span>
          </button>

          <button
            type="button"
            onClick={() => void cerrarSesion()}
            aria-label="Cerrar sesión"
            className="btn min-h-9 border border-white/20 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 dark:border-noche-borde dark:bg-noche-tarjeta"
          >
            <LogOut size={14} strokeWidth={2} />
            <span>Salir</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col overflow-x-hidden bg-fondo lg:flex-row dark:bg-noche ${
        destino === 'radio' ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
      }`}
    >
      {/* Barra lateral fija en escritorio (lg+) con menús desplegables */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col justify-between gap-4 bg-udec-oscuro p-4 text-white lg:flex dark:border-r dark:border-noche-borde dark:bg-noche-sidebar">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 items-center gap-3 border-b border-white/15 pb-3 dark:border-noche-borde">
            <BupcLogo tamano="md" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white/80 dark:text-noche-tinta-suave">
                Universidad de Colima
              </p>
              <h1 className="text-base font-bold tracking-tight">S.A.B.U.P.C</h1>
            </div>
          </div>

          {renderListaNavegacion()}
        </div>

        {renderPiePerfil()}
      </aside>

      {/* Cajón lateral móvil (Drawer fluido < lg) */}
      {drawerAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          <div
            className="fixed inset-0 bg-black/65"
            onClick={() => setDrawerAbierto(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[84vw] flex-col justify-between gap-4 border-r border-white/15 bg-udec-oscuro p-4 text-white dark:border-noche-borde dark:bg-noche-sidebar">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/15 pb-3 dark:border-noche-borde">
                <div className="flex items-center gap-2.5">
                  <BupcLogo tamano="sm" />
                  <div>
                    <p className="text-[11px] font-semibold text-white/80">Universidad de Colima</p>
                    <span className="text-sm font-bold">S.A.B.U.P.C</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerAbierto(false)}
                  aria-label="Cerrar menú"
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {renderListaNavegacion()}
            </div>

            {renderPiePerfil()}
          </aside>
        </div>
      )}

      {/* Contenedor principal */}
      <div
        className={`flex min-w-0 flex-1 flex-col pb-18 lg:pb-0 ${
          destino === 'radio' ? 'min-h-0 overflow-hidden' : ''
        }`}
      >
        {/* Indicador de conexión silencioso (solo visible offline, sincronizando o alertas) */}
        <BarraEstado />

        {/* Encabezado móvil compacto (< lg): sin cambio de tema accidental; Menú >= 44px */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-3 border-naranja bg-udec px-3 py-2 text-white lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <BupcLogo tamano="sm" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white/80">S.A.B.U.P.C</p>
              <h1 className="truncate text-sm font-bold">{TITULOS_DESTINO[destino]}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={abrirFichaEmergenciaDirecta}
              aria-label="Abrir Ficha de Emergencia"
              title="Ficha de Emergencia (1 toque)"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-white/30 bg-alerta text-white hover:bg-alerta-oscuro"
            >
              <HeartPulse size={20} strokeWidth={2.2} />
            </button>
            {fotoPropia?.imagen_webp_base64 && (
              <button
                type="button"
                onClick={() => seleccionarDestino('credencial')}
                aria-label="Ver mi credencial QR"
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/40"
              >
                <img
                  src={fotoPropia.imagen_webp_base64}
                  alt={nombreCompleto(perfil)}
                  className="h-full w-full object-cover"
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setDrawerAbierto(true)}
              aria-label="Abrir menú completo"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main
          className={`flex min-w-0 flex-1 flex-col gap-5 ${
            destino === 'radio'
              ? 'min-h-0 overflow-hidden p-2.5 sm:p-4 lg:p-5'
              : 'p-4 lg:p-6'
          }`}
        >
          {destino === 'credencial' && (
            <CredencialDigitalPage
              key={`cred-${credencialCaraInicial}-${credencialClave}`}
              perfil={perfil}
              caraInicial={credencialCaraInicial}
            />
          )}
          {destino === 'escaner' && (
            <BrigadistaDashboardPage key="escaner" perfil={perfil} enfoque="escaner" />
          )}
          {destino === 'material' && <MiMaterialPanel perfil={perfil} />}
          {destino === 'mi-historial' && (
            <HistorialDualPage key="mi-historial" usuario={perfil} pestanaInicial="personal" />
          )}

          {destino === 'operativos' && soyEncargado && <OperativosPanelPage usuario={perfil} />}

          {destino === 'resguardo' && soyEncargado && (
            <ResguardoGlobalPanel encargado={perfil} />
          )}

          {destino === 'radio' && puedoRadio && <RadioConsolePage usuario={perfil} />}

          {destino === 'personal' && puedoPersonal && (
            <AdminConsolePage key="personal" admin={perfil} embebido pestanaInicial="directorio" />
          )}

          {destino === 'tesla' && soyTesla && <GestionTeslaPanel actor={perfil} />}

          {destino === 'incidencias' && soyEncargado && <IncidenciasPersonalPanel actor={perfil} />}

          {destino === 'archivo' && soyEncargado && (
            <HistorialDualPage key="archivo" usuario={perfil} pestanaInicial="archivo" />
          )}

          {destino === 'catalogos' && soyAdmin && <CatalogosAuditoriaTab admin={perfil} />}

          {destino === 'perfil' && (
            <div className="flex flex-col gap-4">
              <article className="tarjeta mx-auto flex w-full max-w-md flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
                  <div>
                    <h2 className="text-lg font-bold text-tinta dark:text-noche-tinta">
                      {nombreCompleto(perfil)}
                    </h2>
                    <p className="text-xs font-medium tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                      No. de cuenta: {perfil.numero_cuenta} · {perfil.correo}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      enLinea
                        ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                        : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${enLinea ? 'bg-activo dark:bg-activo-claro' : 'bg-ambar'}`}
                    />
                    {enLinea ? 'En línea' : 'Sin conexión'}
                  </span>
                </div>

                <dl className="flex flex-col gap-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Rol del sistema
                    </dt>
                    <dd className="font-semibold text-tinta dark:text-noche-tinta">
                      {ayJefe ? `Encargado · Jefe de ${ayJefe}` : perfil.rol_sistema}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                    <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Etapa / Grupo
                    </dt>
                    <dd className="font-semibold text-tinta dark:text-noche-tinta">
                      {perfil.etapa}
                      {perfil.subgrupo ? ` · ${perfil.subgrupo}` : ''}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                    <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Ayudantía
                    </dt>
                    <dd className="font-semibold text-tinta dark:text-noche-tinta">
                      {etiquetaAyudantia(perfil.ayudantia)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                    <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Radiocomunicación
                    </dt>
                    <dd className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-tinta dark:text-noche-tinta">
                      <Radio size={15} strokeWidth={2} className="text-udec dark:text-activo-claro" />
                      <span>
                        {puedoRadio
                          ? `Autorizado (${perfil.clave_radio || perfil.clave_personal_radio || 'sin clave'})`
                          : 'No autorizado'}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="flex items-start gap-2 rounded-lg border border-borde bg-superficie-suave p-3 text-[11px] leading-snug text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                  <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-udec dark:text-activo-claro" />
                  <span>
                    Tu nombre completo, número de cuenta y correo están protegidos. Si hay algún
                    error en tu nombre o número de cuenta, solicita el ajuste a Administración.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void cerrarSesion()}
                  className="btn-salvia mt-1 w-full"
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Cerrar Sesión</span>
                </button>
              </article>

              <TelefonoPropioPerfilCard perfil={perfil} />

              <FichaEmergenciaPerfilCard perfil={perfil} />
            </div>
          )}
        </main>
      </div>

      {/* Barra inferior limpia en móvil (< lg): máximo estricto de 4 destinos */}
      <nav
        aria-label="Navegación rápida móvil"
        className="fixed right-0 bottom-0 left-0 z-30 grid grid-cols-4 border-t border-borde bg-tarjeta px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden dark:border-noche-borde dark:bg-noche-tarjeta"
      >
        <button
          type="button"
          onClick={() => seleccionarDestino('escaner')}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            destino === 'escaner' || destino === 'material'
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <CalendarCheck size={19} strokeWidth={2} />
          <span>Mi Turno</span>
        </button>

        {soyEncargado ? (
          <button
            type="button"
            onClick={() => seleccionarDestino('operativos')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              destino === 'operativos' || destino === 'resguardo'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <Megaphone size={19} strokeWidth={2} />
            <span>Mando</span>
          </button>
        ) : puedoRadio ? (
          <button
            type="button"
            onClick={() => seleccionarDestino('radio')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              destino === 'radio'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <Radio size={19} strokeWidth={2} />
            <span>Radio</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => seleccionarDestino('mi-historial')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              destino === 'mi-historial'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <History size={19} strokeWidth={2} />
            <span>Historial</span>
          </button>
        )}

        {soyEncargado && puedoRadio ? (
          <button
            type="button"
            onClick={() => seleccionarDestino('radio')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              destino === 'radio'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <Radio size={19} strokeWidth={2} />
            <span>Radio</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => seleccionarDestino('credencial')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              destino === 'credencial'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <IdCard size={19} strokeWidth={2} />
            <span>Credencial</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setDrawerAbierto(true)}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            drawerAbierto
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <Menu size={19} strokeWidth={2} />
          <span>Menú</span>
        </button>
      </nav>
    </div>
  )
}
