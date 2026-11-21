import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, UserCheck } from 'lucide-react'
import { BupcLogo } from '../components/BupcLogo'
import { DELEGACIONES, NIVELES_CAPACITACION, STANDARD_ROLES } from '../data/mockData'

export function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    matricula: '',
    delegacion: DELEGACIONES[0],
    email: '',
    nivel: NIVELES_CAPACITACION[1],
    rol: STANDARD_ROLES[0],
    password: '',
    confirmPassword: '',
    accepted: true,
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [submittedFolio, setSubmittedFolio] = useState('')

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.fullName.trim() || !/^\d{8}$/.test(form.matricula.trim())) {
      setErrorMsg('Verifica tu nombre completo y una matrícula UdeC válida de 8 dígitos.')
      return
    }
    if (!form.email.includes('@')) {
      setErrorMsg('Ingresa un correo institucional válido (@ucol.mx).')
      return
    }
    if (form.password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifica ambos campos.')
      return
    }
    if (!form.accepted) {
      setErrorMsg('Debes aceptar el reglamento operativo de la BUPC para registrarte.')
      return
    }
    setErrorMsg('')
    setSubmittedFolio('REG-2026-089')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] grid grid-cols-1 lg:grid-cols-12">
      {/* Encabezado móvil sticky */}
      <header className="lg:hidden bg-[#3E6E28] text-[#FFFFFF] px-4 py-3.5 sticky top-0 z-30 border-b-[3px] border-[#E65300]">
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            aria-label="Volver al inicio de sesión"
            className="w-11 h-11 rounded-full bg-[#2D521D] flex items-center justify-center text-[#FFFFFF] shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </Link>
          <BupcLogo size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider truncate">
              S.A.B.U.P.C. · Universidad de Colima
            </p>
            <h1 className="text-[16px] font-bold text-[#FFFFFF] truncate tracking-[-0.02em]">
              Registro de Brigadista
            </h1>
          </div>
        </div>
      </header>

      {/* Panel izquierdo Desktop */}
      <aside className="hidden lg:flex lg:col-span-5 bg-[#3E6E28] text-[#FFFFFF] border-r-[3px] border-[#E65300] p-8 flex-col justify-between gap-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BupcLogo size="lg" />
            <div>
              <p className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
                Universidad de Colima
              </p>
              <p className="text-[18px] font-bold text-[#FFFFFF]">Protección Civil</p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3.5 min-h-10 rounded-lg bg-[#2D521D] text-[#FFFFFF] text-[13px] font-semibold hover:bg-[#234116]"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Volver</span>
          </Link>
        </div>

        <div className="flex flex-col gap-5 max-w-md">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold text-[#FFFFFF] tracking-[-0.02em]">
              Registro de Brigadista
            </h1>
            <p className="text-[15px] text-[#EAF2E4] leading-relaxed">
              Crea tu perfil oficial en la BUPC para obtener tu credencial digital QR y acumular
              horas válidas para constancias universitarias.
            </p>
          </div>

          <div className="bg-[#2D521D] rounded-xl p-4 border border-[#EAF2E4]/20 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
              Proceso de activación
            </span>
            <p className="text-[14px] text-[#FFFFFF]">
              Al enviar tus datos, tu Encargado de Delegación validará tu matrícula institucional para
              habilitar el escáner en operativos y guardias.
            </p>
          </div>
        </div>

        <footer className="pt-4 border-t border-[#FFFFFF]/15 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
            Pertinencia que Transforma
          </span>
          <span className="text-[12px] text-[#EAF2E4]">
            Dirección General de Protección Civil Universitaria
          </span>
        </footer>
      </aside>

      {/* Panel derecho / principal: Formulario */}
      <main className="lg:col-span-7 flex flex-col items-center justify-center p-4 py-5 lg:p-8">
        <div className="w-full max-w-lg flex flex-col gap-4">
          {submittedFolio && (
            <div
              role="alert"
              className="rounded-xl border border-[#059669] bg-[#ECFDF5] text-[#065F46] p-4 flex items-start gap-3"
            >
              <CheckCircle2 size={20} strokeWidth={2} className="text-[#059669] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold">Solicitud registrada correctamente</p>
                <p className="text-[13px]">
                  Tu folio <span className="font-bold tabular-nums">{submittedFolio}</span> quedó
                  pendiente de validación por tu Encargado de Delegación.
                </p>
                <Link to="/login" className="text-[13px] font-semibold underline mt-1">
                  Ir a Iniciar sesión
                </Link>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#DC2626] bg-[#FEF2F2] text-[#991B1B] p-4 flex items-start gap-3"
            >
              <AlertTriangle size={20} strokeWidth={2} className="text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium">{errorMsg}</p>
            </div>
          )}

          <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-8 flex flex-col gap-5 shadow-xs">
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111827] tracking-[-0.02em]">
                Datos del Brigadista
              </h2>
              <p className="text-[14px] text-[#4B5563]">
                Completa tu perfil para generar tu credencial QR oficial y registrar asistencias.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="fullName" className="text-[12px] font-semibold text-[#111827]">
                    Nombre completo
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                    placeholder="Ej. Sofía Alejandra Vega"
                    required
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="matricula" className="text-[12px] font-semibold text-[#111827]">
                    Matrícula UdeC
                  </label>
                  <input
                    id="matricula"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={form.matricula}
                    onChange={handleChange('matricula')}
                    placeholder="20241234"
                    required
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] font-medium tabular-nums focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="delegacion" className="text-[12px] font-semibold text-[#111827]">
                    Delegación
                  </label>
                  <select
                    id="delegacion"
                    value={form.delegacion}
                    onChange={handleChange('delegacion')}
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  >
                    {DELEGACIONES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="emailUcol" className="text-[12px] font-semibold text-[#111827]">
                    Correo institucional
                  </label>
                  <input
                    id="emailUcol"
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="nombre@ucol.mx"
                    required
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nivelCap" className="text-[12px] font-semibold text-[#111827]">
                    Nivel de capacitación
                  </label>
                  <select
                    id="nivelCap"
                    value={form.nivel}
                    onChange={handleChange('nivel')}
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  >
                    {NIVELES_CAPACITACION.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rolPref" className="text-[12px] font-semibold text-[#111827]">
                    Rol operativo principal
                  </label>
                  <select
                    id="rolPref"
                    value={form.rol}
                    onChange={handleChange('rol')}
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  >
                    {STANDARD_ROLES.filter((r) => r !== 'Encargado').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="passReg" className="text-[12px] font-semibold text-[#111827]">
                    Contraseña
                  </label>
                  <input
                    id="passReg"
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    placeholder="Mín. 8 caracteres"
                    required
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="passConfirm" className="text-[12px] font-semibold text-[#111827]">
                    Confirmar contraseña
                  </label>
                  <input
                    id="passConfirm"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    placeholder="Repite la clave"
                    required
                    className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.accepted}
                  onChange={handleChange('accepted')}
                  className="mt-1 w-4 h-4 rounded accent-[#3E6E28] shrink-0"
                />
                <span className="text-[12px] text-[#4B5563]">
                  Acepto el reglamento operativo de la BUPC y el uso de mi matrícula para control de
                  asistencia.
                </span>
              </label>

              {/* Único CTA naranja permitido en la vista */}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-5 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[14px] font-bold transition-colors"
              >
                <UserCheck size={18} strokeWidth={2} />
                <span>Crear cuenta de Brigadista</span>
              </button>

              <p className="text-center text-[14px] text-[#4B5563]">
                ¿Ya estás registrado?{' '}
                <Link to="/login" className="font-semibold text-[#3E6E28] hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
