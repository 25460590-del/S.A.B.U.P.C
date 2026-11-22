import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FolderArchive,
  History,
  IdCard,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  QrCode,
  Radio,
  Shield,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import { CatalogosAuditoriaTab } from '../components/CatalogosAuditoriaTab'
import { GestionTeslaPanel } from '../components/GestionTeslaPanel'
import { IncidenciasPersonalPanel } from '../components/IncidenciasPersonalPanel'
import { MiMaterialPanel } from '../components/MiMaterialPanel'
import { ResguardoGlobalPanel } from '../components/ResguardoGlobalPanel'
import { useTema } from '../context/TemaContext'
import {
  esAdmin,
  esEncargado,
  esEncargadoAP,
  esEncargadoTesla,
  puedeUsarRadio,
} from '../lib/permisos'
import { cerrarSesion, nombreCompleto } from '../services/authService'
import type { Usuario } from '../types'
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
  escaner: 'Escáner QR',
  material: 'Mi Material',
  'mi-historial': 'Mi Historial',
  operativos: 'Operativos',
  resguardo: 'Resguardo Global de Material',
  radio: 'Consola de Radio',
  personal: 'Personal',
  tesla: 'Claves TESLA',
  incidencias: 'Incidencias',
  archivo: 'Archivo Operativo Global',
  catalogos: 'Catálogos y Auditoría',
  perfil: 'Mi Perfil',
}

/**
 * Shell operativo unificado y responsive (PC + Móvil) con RBAC estrictamente aditivo:
 * Brigadista ⊂ Encargado ⊂ Administrador.
 */
export function PanelActivoPage({ perfil }: PanelActivoPageProps) {
  const { esOscuro, alternarTema } = useTema()

  const soyAdmin = esAdmin(perfil)
  const soyEncargado = esEncargado(perfil)
  const soyAP = esEncargadoAP(perfil)
  const soyTesla = esEncargadoTesla(perfil)
  const puedoRadio = puedeUsarRadio(perfil)
  const tengoGruposACargo = (perfil.grupos_a_cargo?.length ?? 0) > 0
  const puedoPersonal = soyAdmin || soyAP || (soyEncargado && tengoGruposACargo)

  const destinoInicial: DestinoNavegacion = soyAdmin
    ? 'personal'
    : soyEncargado
      ? 'operativos'
      : 'escaner'

  const [destino, setDestino] = useState<DestinoNavegacion>(destinoInicial)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<GrupoId, boolean>>({
    mi_espacio: true,
    operacion: soyEncargado || puedoRadio,
    gestion: soyAdmin || soyAP || soyTesla,
  })

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
        { id: 'escaner', etiqueta: 'Escáner QR', icono: <QrCode size={17} strokeWidth={2} /> },
        { id: 'material', etiqueta: 'Mi Material', icono: <Package size={17} strokeWidth={2} /> },
        { id: 'mi-historial', etiqueta: 'Mi Historial', icono: <History size={17} strokeWidth={2} /> },
      ],
    },
  ]

  const itemsOperacion: ItemMenu[] = []
  if (soyEncargado) {
    itemsOperacion.push(
      { id: 'operativos', etiqueta: 'Operativos', icono: <Megaphone size={17} strokeWidth={2} /> },
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
      etiqueta: soyAdmin || soyAP ? 'Admin. de Personal' : 'Mi Personal',
      icono: soyAdmin || soyAP ? <UserCheck size={17} strokeWidth={2} /> : <Users size={17} strokeWidth={2} />,
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
    setDestino(nuevo)
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
                {perfil.rol_sistema}
                {perfil.ayudantia !== 'Ninguna' ? ` · ${perfil.ayudantia}` : ''}
              </span>
            </span>
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
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-fondo lg:flex-row dark:bg-noche">
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
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setDrawerAbierto(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[84vw] flex-col justify-between gap-4 bg-udec-oscuro p-4 text-white shadow-xl dark:border-r dark:border-noche-borde dark:bg-noche-sidebar">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/15 pb-3 dark:border-noche-borde">
                <div className="flex items-center gap-2.5">
                  <BupcLogo tamano="sm" />
                  <div>
                    <p className="text-[10px] font-semibold text-white/80">Universidad de Colima</p>
                    <span className="text-sm font-bold">S.A.B.U.P.C</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerAbierto(false)}
                  aria-label="Cerrar menú"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10"
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
      <div className="flex min-w-0 flex-1 flex-col pb-18 lg:pb-0">
        {/* Indicador de conexión silencioso (solo visible offline o sincronizando) */}
        <BarraEstado />

        {/* Encabezado móvil compacto (< lg) */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-3 border-naranja bg-udec px-3 py-2.5 text-white lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <BupcLogo tamano="sm" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-white/80">S.A.B.U.P.C</p>
              <h1 className="truncate text-sm font-bold">{TITULOS_DESTINO[destino]}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={alternarTema}
              aria-label={esOscuro ? 'Cambiar a modo día' : 'Cambiar a modo nocturno'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              {esOscuro ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </button>
            <button
              type="button"
              onClick={() => setDrawerAbierto(true)}
              aria-label="Abrir menú completo"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              <Menu size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main
          className={`flex min-w-0 flex-1 flex-col gap-5 ${
            destino === 'radio' ? 'p-2.5 sm:p-4 lg:p-5' : 'p-4 lg:p-6'
          }`}
        >
          {destino === 'credencial' && <CredencialDigitalPage perfil={perfil} />}
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
            <AdminConsolePage key="personal" admin={perfil} embebido pestanaInicial="pendientes" />
          )}

          {destino === 'tesla' && soyTesla && <GestionTeslaPanel actor={perfil} />}

          {destino === 'incidencias' && soyEncargado && <IncidenciasPersonalPanel actor={perfil} />}

          {destino === 'archivo' && soyEncargado && (
            <HistorialDualPage key="archivo" usuario={perfil} pestanaInicial="archivo" />
          )}

          {destino === 'catalogos' && soyAdmin && <CatalogosAuditoriaTab admin={perfil} />}

          {destino === 'perfil' && (
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
                    {perfil.rol_sistema}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Etapa / Subgrupo
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
                    {perfil.ayudantia}
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

              <button
                type="button"
                onClick={() => void cerrarSesion()}
                className="btn-salvia mt-2 w-full"
              >
                <LogOut size={18} strokeWidth={2} />
                <span>Cerrar Sesión</span>
              </button>
            </article>
          )}
        </main>
      </div>

      {/* Barra inferior limpia en móvil (< lg) con accesos rápidos prioritarios */}
      <nav
        aria-label="Navegación rápida móvil"
        className={`fixed right-0 bottom-0 left-0 z-30 grid border-t border-borde bg-tarjeta px-1 py-1 lg:hidden dark:border-noche-borde dark:bg-noche-tarjeta ${
          puedoRadio ? 'grid-cols-5' : 'grid-cols-4'
        }`}
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
          <QrCode size={19} strokeWidth={2} />
          <span>Escáner</span>
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
            <span>Operativos</span>
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

        {puedoRadio && (
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
        )}

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
