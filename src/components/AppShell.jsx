import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  ScanLine,
  Shield,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BupcLogo } from './BupcLogo'

const DESKTOP_NAV = [
  { to: '/puesto-de-mando', label: 'Guardias y Operativos', icon: LayoutDashboard },
  { to: '/bitacora', label: 'Bitácora en Tiempo Real', icon: ClipboardList },
  { to: '/escaner', label: 'Escáner QR (Campo)', icon: ScanLine },
  { to: '/mi-qr', label: 'Mi Credencial QR', icon: QrCode },
  { to: '/historial', label: 'Perfil e Historial', icon: History },
]

const MOBILE_NAV = [
  { to: '/escaner', label: 'Escáner', icon: ScanLine },
  { to: '/puesto-de-mando', label: 'Operativos', icon: Shield },
  { to: '/mi-qr', label: 'Mi QR', icon: QrCode },
  { to: '/historial', label: 'Historial', icon: History },
]

export function AppShell({
  title,
  subtitle,
  mobileTitle,
  mobileSubtitle,
  headerRight,
  mobileHeaderRight,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, roleType, loginAs } = useApp()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F4F6F8] text-[#111827]">
      {/* Barra lateral colapsable en escritorio (>= 768px) */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 bg-[#2D521D] text-[#FFFFFF] border-r border-[#3E6E28] transition-all duration-150 sticky top-0 h-screen ${
          collapsed ? 'w-20' : 'w-60'
        }`}
      >
        <div className="flex flex-col gap-5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Link to="/puesto-de-mando" className="flex items-center gap-3 min-w-0">
              <BupcLogo size="sm" />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-[#FFFFFF] truncate tracking-tight">
                    S.A.B.U.P.C.
                  </p>
                  <p className="text-[11px] font-semibold text-[#EAF2E4] truncate">
                    Puesto de Mando
                  </p>
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#EAF2E4] hover:bg-[#3E6E28] shrink-0"
            >
              {collapsed ? (
                <PanelLeftOpen size={18} strokeWidth={2} />
              ) : (
                <PanelLeftClose size={18} strokeWidth={2} />
              )}
            </button>
          </div>

          <nav aria-label="Navegación principal escritorio">
            <ul className="flex flex-col gap-1">
              {DESKTOP_NAV.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 min-h-11 rounded-lg text-[13px] font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#3E6E28] text-[#FFFFFF] border-l-[3px] border-[#E65300]'
                            : 'text-[#EAF2E4] hover:bg-[#3E6E28]'
                        }`
                      }
                    >
                      <Icon size={18} strokeWidth={2} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        <div className="p-3.5 border-t border-[#3E6E28] flex flex-col gap-2.5">
          {!collapsed && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#234116]">
              <button
                type="button"
                onClick={() => loginAs('brigadista')}
                className={`py-1.5 px-2 rounded-md text-[11px] font-semibold ${
                  roleType === 'brigadista'
                    ? 'bg-[#EAF2E4] text-[#284A19]'
                    : 'text-[#EAF2E4] hover:text-[#FFFFFF]'
                }`}
              >
                Brigadista
              </button>
              <button
                type="button"
                onClick={() => loginAs('encargado')}
                className={`py-1.5 px-2 rounded-md text-[11px] font-semibold ${
                  roleType === 'encargado'
                    ? 'bg-[#EAF2E4] text-[#284A19]'
                    : 'text-[#EAF2E4] hover:text-[#FFFFFF]'
                }`}
              >
                Encargado
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#EAF2E4] text-[#284A19] border border-[#C8DDB9] flex items-center justify-center text-[12px] font-bold shrink-0">
                {currentUser.initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#FFFFFF] truncate">
                    {currentUser.shortName}
                  </p>
                  <p className="text-[11px] font-medium text-[#EAF2E4] truncate">
                    {currentUser.roleLabel}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={() => navigate('/login')}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#EAF2E4] hover:bg-[#3E6E28] shrink-0"
              >
                <LogOut size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Encabezado Móvil (< 768px) */}
        <header className="md:hidden bg-[#3E6E28] text-[#FFFFFF] px-4 py-3.5 sticky top-0 z-30 border-b-[3px] border-[#E65300]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BupcLogo size="md" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider truncate">
                  {mobileSubtitle || 'BUPC · Universidad de Colima'}
                </p>
                <h1 className="text-[16px] font-bold text-[#FFFFFF] truncate tracking-[-0.02em]">
                  {mobileTitle || title}
                </h1>
              </div>
            </div>
            {mobileHeaderRight || headerRight}
          </div>
        </header>

        {/* Encabezado Escritorio (>= 768px) */}
        <header className="hidden md:flex bg-[#FFFFFF] border-t-[3px] border-t-[#3E6E28] border-b border-[#E2E8F0] px-6 py-4 items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-[-0.02em] truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[14px] font-normal text-[#4B5563] truncate">{subtitle}</p>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-3 shrink-0">{headerRight}</div>}
        </header>

        {/* Contenido */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8 flex flex-col gap-5">
          {children}
        </main>
      </div>

      {/* Navegación inferior fija en móvil (< 768px) — exactamente 4 destinos */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 inset-x-0 bg-[#FFFFFF] border-t border-[#E2E8F0] z-40 px-2 py-1.5"
      >
        <ul className="grid grid-cols-4 gap-1">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 min-h-12 rounded-lg text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#EAF2E4] text-[#284A19] border border-[#C8DDB9]'
                        : 'text-[#4B5563] hover:text-[#111827]'
                    }`
                  }
                >
                  <Icon size={20} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
