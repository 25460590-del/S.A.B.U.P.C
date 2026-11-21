import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogIn,
  ScanLine,
  User,
  UserPlus,
} from 'lucide-react'
import { BupcLogo } from '../components/BupcLogo'
import { useApp } from '../context/AppContext'

export function LoginPage() {
  const { loginAs } = useApp()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState('brigadista')
  const [usuario, setUsuario] = useState('20214892')
  const [password, setPassword] = useState('bupc2026')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [recoveryInfo, setRecoveryInfo] = useState(false)

  const handleRoleSwitch = (role) => {
    setSelectedRole(role)
    setUsuario(role === 'encargado' ? '20193104' : '20214892')
    setErrorMsg('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!usuario.trim() || password.length < 4) {
      setErrorMsg('Ingresa tu matrícula UdeC y una contraseña válida para continuar.')
      return
    }
    setErrorMsg('')
    loginAs(selectedRole)
    navigate(selectedRole === 'encargado' ? '/puesto-de-mando' : '/escaner')
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] grid grid-cols-1 lg:grid-cols-12">
      {/* Panel institucional Verde Universitario (Desktop izquierda / Mobile arriba) */}
      <aside className="lg:col-span-5 bg-[#3E6E28] text-[#FFFFFF] border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-[#E65300] px-5 py-7 lg:p-8 flex flex-col justify-between gap-6">
        {/* Encabezado Móvil centrado */}
        <div className="flex flex-col items-center text-center gap-3 lg:hidden">
          <BupcLogo size="xl" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#FFFFFF]">
              S.A.B.U.P.C.
            </h1>
            <p className="text-[14px] text-[#EAF2E4]">
              Sistema de Asistencia · Brigada Universitaria de Protección Civil
            </p>
          </div>
        </div>

        {/* Encabezado Desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <BupcLogo size="lg" />
          <div>
            <p className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
              Universidad de Colima
            </p>
            <p className="text-[18px] font-bold text-[#FFFFFF]">Protección Civil</p>
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-6 max-w-md">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold text-[#FFFFFF] tracking-[-0.02em]">
              S.A.B.U.P.C.
            </h1>
            <p className="text-[15px] text-[#EAF2E4] leading-relaxed">
              Sistema de Asistencia de la Brigada Universitaria de Protección Civil para control de
              guardias, operativos y constancias.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-[#2D521D] flex items-center justify-center shrink-0 text-[#EAF2E4]">
                <ScanLine size={18} strokeWidth={2} />
              </span>
              <span className="text-[14px] text-[#FFFFFF]">
                Registro inmediato de entrada y salida por QR en campo
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-[#2D521D] flex items-center justify-center shrink-0 text-[#EAF2E4]">
                <LayoutDashboard size={18} strokeWidth={2} />
              </span>
              <span className="text-[14px] text-[#FFFFFF]">
                Monitoreo en tiempo real desde Puesto de Mando
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-[#2D521D] flex items-center justify-center shrink-0 text-[#EAF2E4]">
                <Award size={18} strokeWidth={2} />
              </span>
              <span className="text-[14px] text-[#FFFFFF]">
                Conteo automático de horas acumuladas y bitácora CSV
              </span>
            </li>
          </ul>
        </div>

        <footer className="hidden lg:flex pt-4 border-t border-[#FFFFFF]/15 flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
            Pertinencia que Transforma
          </span>
          <span className="text-[12px] text-[#EAF2E4]">
            Dirección General de Protección Civil Universitaria
          </span>
        </footer>
      </aside>

      {/* Panel derecho / inferior: Formulario de acceso */}
      <main className="lg:col-span-7 flex flex-col items-center justify-between lg:justify-center p-4 py-6 lg:p-8 gap-6">
        <section className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-8 flex flex-col gap-5 shadow-xs">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111827] tracking-[-0.02em]">
              Acceso operativo
            </h2>
            <p className="text-[14px] text-[#4B5563]">
              Ingresa con tu matrícula universitaria o cuenta de Puesto de Mando.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-[#DC2626] bg-[#FEF2F2] text-[#991B1B] p-3 flex items-start gap-2.5 text-[13px] font-medium"
            >
              <AlertTriangle size={18} strokeWidth={2} className="text-[#DC2626] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {recoveryInfo && (
            <div
              role="status"
              className="rounded-lg border border-[#C8DDB9] bg-[#EAF2E4] text-[#284A19] p-3 text-[13px] font-medium"
            >
              Solicita el restablecimiento de clave directamente en Puesto de Mando o con tu
              Encargado de Delegación.
            </div>
          )}

          {/* Selector de perfil (Brigadista / Encargado) */}
          <div
            className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
            role="group"
            aria-label="Tipo de acceso"
          >
            <button
              type="button"
              onClick={() => handleRoleSwitch('brigadista')}
              className={`min-h-12 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                selectedRole === 'brigadista'
                  ? 'bg-[#3E6E28] text-[#FFFFFF]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              Brigadista
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('encargado')}
              className={`min-h-12 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                selectedRole === 'encargado'
                  ? 'bg-[#3E6E28] text-[#FFFFFF]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              Encargado
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="userInput" className="text-[12px] font-semibold text-[#111827]">
                Usuario o Matrícula UdeC
              </label>
              <div className="relative">
                <User
                  size={18}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                />
                <input
                  id="userInput"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ej. 20214892"
                  required
                  className="w-full pl-10 pr-3 min-h-12 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] font-medium tabular-nums focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="passInput" className="text-[12px] font-semibold text-[#111827]">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                />
                <input
                  id="passInput"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 min-h-12 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] font-normal focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#4B5563] hover:text-[#111827]"
                >
                  {showPass ? (
                    <EyeOff size={18} strokeWidth={2} />
                  ) : (
                    <Eye size={18} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#3E6E28]"
                />
                <span className="text-[12px] font-medium text-[#4B5563]">Recordar sesión</span>
              </label>
              <button
                type="button"
                onClick={() => setRecoveryInfo((v) => !v)}
                className="text-[12px] font-semibold text-[#3E6E28] hover:underline"
              >
                ¿Olvidaste tu clave?
              </button>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              {/* Único CTA naranja permitido en la vista */}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-5 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[14px] font-bold transition-colors"
              >
                <LogIn size={18} strokeWidth={2} />
                <span>Iniciar sesión</span>
              </button>

              {/* CTA secundario verde suave */}
              <Link
                to="/registro"
                className="w-full inline-flex items-center justify-center gap-2 px-5 min-h-12 rounded-lg bg-[#EAF2E4] hover:bg-[#dcead2] text-[#284A19] border border-[#C8DDB9] text-[14px] font-semibold transition-colors"
              >
                <UserPlus size={18} strokeWidth={2} />
                <span>Registrarme como Brigadista</span>
              </Link>
            </div>
          </form>
        </section>

        {/* Pie institucional visible en móvil */}
        <footer className="lg:hidden py-2 flex flex-col items-center gap-1.5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF2E4] border border-[#C8DDB9] text-[#284A19]">
            <span className="w-2 h-2 rounded-full bg-[#3E6E28]" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Universidad de Colima · Pertinencia que Transforma
            </span>
          </div>
          <p className="text-[11px] text-[#4B5563]">
            Dirección General de Protección Civil Universitaria
          </p>
        </footer>
      </main>
    </div>
  )
}
