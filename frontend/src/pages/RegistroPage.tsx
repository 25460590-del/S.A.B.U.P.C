import type { User } from 'firebase/auth'
import { AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import {
  CARRERAS_SUPERIOR,
  NIVELES_ACADEMICOS,
  OPCION_OTRA_CARRERA,
  SEXOS,
  TIPOS_SANGRE,
} from '../constants/catalogos'
import {
  esTelefonoValido,
  normalizarNombrePropio,
  normalizarParentesco,
} from '../lib/nombres'
import {
  completarRegistroGoogle,
  mensajeDeError,
  registrarBrigadista,
} from '../services/authService'
import type { NivelAcademico, Sexo, TipoSangre } from '../types'

interface RegistroPageProps {
  usuarioGoogle?: User
  alVolverALogin: () => void
}

type Paso = 1 | 2 | 3

const SUBTITULOS: Record<Paso, string> = {
  1: 'Paso 1 de 3 · Personal y Contacto',
  2: 'Paso 2 de 3 · Académico',
  3: 'Paso 3 de 3 · Ficha de Emergencia',
}

export function RegistroPage({ usuarioGoogle, alVolverALogin }: RegistroPageProps) {
  const esGoogle = Boolean(usuarioGoogle)
  const [paso, setPaso] = useState<Paso>(1)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrarPass, setMostrarPass] = useState(false)

  // Paso 1: Cuenta + Personal y Contacto
  const [correo, setCorreo] = useState(usuarioGoogle?.email ?? '')
  const [contrasena, setContrasena] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [nombres, setNombres] = useState(usuarioGoogle?.displayName?.split(' ')[0] ?? '')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [sexo, setSexo] = useState<Sexo>('Mujer')
  const [telefonoFijo, setTelefonoFijo] = useState('')
  const [celular, setCelular] = useState('')
  const [celularConWhatsapp, setCelularConWhatsapp] = useState(true)

  // Paso 2: Académico
  const [nivelAcademico, setNivelAcademico] = useState<NivelAcademico>('Superior')
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(CARRERAS_SUPERIOR[0])
  const [otraCarrera, setOtraCarrera] = useState('')
  const [escuelaLibre, setEscuelaLibre] = useState('')
  const [numeroCuenta, setNumeroCuenta] = useState('')

  // Paso 3: Ficha de Emergencia
  const [tipoSangre, setTipoSangre] = useState<TipoSangre>('O+')
  const [alergias, setAlergias] = useState('')
  const [padecimientos, setPadecimientos] = useState('')
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState('')
  const [contactoEmergenciaParentesco, setContactoEmergenciaParentesco] = useState('')
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState('')

  function obtenerEscuelaCarrera(): string {
    if (nivelAcademico === 'Superior') {
      return carreraSeleccionada === OPCION_OTRA_CARRERA
        ? otraCarrera.trim()
        : carreraSeleccionada
    }
    return escuelaLibre.trim()
  }

  function validarPaso1(): string | null {
    if (!esGoogle) {
      if (!correo.trim() || !correo.includes('@')) return 'Ingresa un correo electrónico válido.'
      if (contrasena.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
      if (contrasena !== confirmarContrasena) return 'Las contraseñas no coinciden.'
    }
    if (!nombres.trim()) return 'Ingresa tu(s) nombre(s).'
    if (!apellidoPaterno.trim()) return 'Ingresa tu apellido paterno.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
      return 'Selecciona tu fecha de nacimiento.'
    }
    if (!celular.trim()) return 'Ingresa tu número de celular.'
    return null
  }

  function validarPaso2(): string | null {
    if (!obtenerEscuelaCarrera()) {
      return nivelAcademico === 'Superior'
        ? 'Especifica tu carrera.'
        : 'Indica tu plantel, bachillerato o institución.'
    }
    const cuenta = numeroCuenta.trim()
    if (!cuenta || cuenta.length > 12) {
      return 'Ingresa tu número de cuenta UdeC (escribe 0 si no aplica).'
    }
    return null
  }

  function validarPaso3(): string | null {
    if (!contactoEmergenciaNombre.trim()) return 'Ingresa el nombre del contacto de emergencia.'
    if (!contactoEmergenciaParentesco.trim()) return 'Ingresa el parentesco del contacto de emergencia.'
    if (!contactoEmergenciaTelefono.trim()) return 'Ingresa el teléfono de emergencia.'
    if (!esTelefonoValido(contactoEmergenciaTelefono)) {
      return 'Ingresa un teléfono de emergencia válido de al menos 10 dígitos.'
    }
    return null
  }

  function irAPaso(destino: Paso) {
    setError(null)
    if (destino > paso) {
      if (paso === 1) {
        const msg = validarPaso1()
        if (msg) return setError(msg)
      }
      if (destino === 3) {
        const msg1 = validarPaso1()
        if (msg1) return setError(msg1)
        const msg2 = validarPaso2()
        if (msg2) return setError(msg2)
      }
    }
    setPaso(destino)
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const msg = validarPaso1() ?? validarPaso2() ?? validarPaso3()
    if (msg) {
      setError(msg)
      return
    }

    setEnviando(true)
    try {
      const payloadComun = {
        personal: {
          nombres: normalizarNombrePropio(nombres),
          apellido_paterno: normalizarNombrePropio(apellidoPaterno),
          apellido_materno: normalizarNombrePropio(apellidoMaterno),
          fecha_nacimiento: fechaNacimiento,
          sexo,
          telefono_fijo: telefonoFijo.trim(),
          celular: celular.trim(),
          celular_con_whatsapp: celularConWhatsapp,
        },
        academico: {
          nivel_academico: nivelAcademico,
          escuela_carrera: obtenerEscuelaCarrera(),
          numero_cuenta: numeroCuenta.trim(),
        },
        medico: {
          tipo_sangre: tipoSangre,
          alergias: alergias.trim() || 'Ninguna',
          padecimientos_medicamentos: padecimientos.trim() || 'Ninguno',
          contacto_emergencia_nombre: normalizarNombrePropio(contactoEmergenciaNombre),
          contacto_emergencia_parentesco: normalizarParentesco(contactoEmergenciaParentesco),
          contacto_emergencia_telefono: contactoEmergenciaTelefono.trim(),
        },
      }

      if (usuarioGoogle) {
        await completarRegistroGoogle(usuarioGoogle, payloadComun)
      } else {
        await registrarBrigadista({
          correo: correo.trim(),
          contrasena,
          ...payloadComun,
        })
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fondo dark:bg-noche">
      <BarraEstado etiquetaDerecha="Alta de Brigadista" />

      {/* Encabezado Verde UdeC */}
      <header className="flex items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-4 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={alVolverALogin}
            aria-label="Volver a inicio de sesión"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-base font-bold">Registro de Brigadista</h1>
            <p className="text-xs font-medium text-white/85">{SUBTITULOS[paso]}</p>
          </div>
        </div>
        <BupcLogo tamano="sm" />
      </header>

      {/* Barra de progreso en Verde UdeC */}
      <section
        aria-label="Progreso de registro"
        className="flex flex-col gap-2 border-b border-borde bg-tarjeta px-4 py-3 dark:border-noche-borde dark:bg-noche-tarjeta"
      >
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              [1, '1. Personal'],
              [2, '2. Académico'],
              [3, '3. Emergencia'],
            ] as const
          ).map(([num, texto]) => {
            const activo = num <= paso
            return (
              <button
                key={num}
                type="button"
                onClick={() => irAPaso(num)}
                className={`cursor-pointer rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors ${
                  activo
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                {texto}
              </button>
            )
          })}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-esqueleto dark:bg-noche-campo">
          <div
            className={`h-full rounded-full bg-udec transition-all dark:bg-activo-claro ${
              paso === 1 ? 'w-1/3' : paso === 2 ? 'w-2/3' : 'w-full'
            }`}
          />
        </div>
      </section>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
          >
            <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} noValidate>
          {/* PASO 1: Personal y Contacto */}
          {paso === 1 && (
            <article className="tarjeta flex flex-col gap-4 p-4">
              <h2 className="text-lg font-semibold text-tinta dark:text-noche-tinta">
                Datos Personales y Contacto
              </h2>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-correo" className="etiqueta">
                    Correo electrónico {esGoogle ? '(verificado con Google)' : ''}
                  </label>
                  <input
                    id="reg-correo"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@ucol.mx"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    readOnly={esGoogle}
                    className={`campo ${esGoogle ? 'cursor-not-allowed opacity-80' : ''}`}
                    required
                  />
                </div>

                {!esGoogle && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reg-pass" className="etiqueta">
                        Contraseña
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="reg-pass"
                          type={mostrarPass ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Mínimo 6 caracteres"
                          value={contrasena}
                          onChange={(e) => setContrasena(e.target.value)}
                          className="campo pr-11"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarPass((v) => !v)}
                          aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center text-tinta-suave dark:text-noche-tinta-suave"
                        >
                          {mostrarPass ? (
                            <EyeOff size={18} strokeWidth={2} />
                          ) : (
                            <Eye size={18} strokeWidth={2} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reg-pass2" className="etiqueta">
                        Confirmar contraseña
                      </label>
                      <input
                        id="reg-pass2"
                        type={mostrarPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Repite la contraseña"
                        value={confirmarContrasena}
                        onChange={(e) => setConfirmarContrasena(e.target.value)}
                        className="campo"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="border-t border-borde pt-3 dark:border-noche-borde">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reg-nombres" className="etiqueta">
                        Nombre(s)
                      </label>
                      <input
                        id="reg-nombres"
                        type="text"
                        maxLength={80}
                        placeholder="Nombre(s)"
                        value={nombres}
                        onChange={(e) => setNombres(e.target.value)}
                        className="campo"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-paterno" className="etiqueta">
                          Apellido paterno
                        </label>
                        <input
                          id="reg-paterno"
                          type="text"
                          maxLength={60}
                          value={apellidoPaterno}
                          onChange={(e) => setApellidoPaterno(e.target.value)}
                          className="campo"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-materno" className="etiqueta">
                          Apellido materno
                        </label>
                        <input
                          id="reg-materno"
                          type="text"
                          maxLength={60}
                          value={apellidoMaterno}
                          onChange={(e) => setApellidoMaterno(e.target.value)}
                          className="campo"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-nac" className="etiqueta">
                          Fecha de nacimiento
                        </label>
                        <input
                          id="reg-nac"
                          type="date"
                          value={fechaNacimiento}
                          onChange={(e) => setFechaNacimiento(e.target.value)}
                          className="campo tabular-nums"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-sexo" className="etiqueta">
                          Sexo
                        </label>
                        <select
                          id="reg-sexo"
                          value={sexo}
                          onChange={(e) => setSexo(e.target.value as Sexo)}
                          className="campo"
                        >
                          {SEXOS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-fijo" className="etiqueta">
                          Teléfono fijo
                        </label>
                        <input
                          id="reg-fijo"
                          type="tel"
                          maxLength={20}
                          placeholder="Opcional"
                          value={telefonoFijo}
                          onChange={(e) => setTelefonoFijo(e.target.value)}
                          className="campo tabular-nums"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-cel" className="etiqueta">
                          Celular
                        </label>
                        <input
                          id="reg-cel"
                          type="tel"
                          maxLength={20}
                          placeholder="10 dígitos"
                          value={celular}
                          onChange={(e) => setCelular(e.target.value)}
                          className="campo tabular-nums"
                          required
                        />
                      </div>
                    </div>

                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 py-2 dark:border-noche-borde dark:bg-noche-campo">
                      <input
                        type="checkbox"
                        checked={celularConWhatsapp}
                        onChange={(e) => setCelularConWhatsapp(e.target.checked)}
                        className="h-5 w-5 rounded accent-udec"
                      />
                      <span className="text-sm font-semibold text-udec-oscuro dark:text-noche-tinta">
                        Este celular tiene WhatsApp activo
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => irAPaso(2)} className="btn-verde w-full">
                Continuar a Datos Académicos
              </button>
            </article>
          )}

          {/* PASO 2: Académico */}
          {paso === 2 && (
            <article className="tarjeta flex flex-col gap-4 p-4">
              <h2 className="text-lg font-semibold text-tinta dark:text-noche-tinta">
                Datos Académicos
              </h2>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-nivel" className="etiqueta">
                    Adscripción académica
                  </label>
                  <select
                    id="reg-nivel"
                    value={nivelAcademico}
                    onChange={(e) => setNivelAcademico(e.target.value as NivelAcademico)}
                    className="campo"
                  >
                    {NIVELES_ACADEMICOS.map((nivel) => (
                      <option key={nivel} value={nivel}>
                        {nivel}
                      </option>
                    ))}
                  </select>
                </div>

                {nivelAcademico === 'Superior' ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reg-carrera" className="etiqueta">
                        Carrera
                      </label>
                      <select
                        id="reg-carrera"
                        value={carreraSeleccionada}
                        onChange={(e) => setCarreraSeleccionada(e.target.value)}
                        className="campo"
                      >
                        {CARRERAS_SUPERIOR.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value={OPCION_OTRA_CARRERA}>{OPCION_OTRA_CARRERA}</option>
                      </select>
                    </div>
                    {carreraSeleccionada === OPCION_OTRA_CARRERA && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="reg-otra-carrera" className="etiqueta">
                          Especifica tu carrera
                        </label>
                        <input
                          id="reg-otra-carrera"
                          type="text"
                          maxLength={120}
                          placeholder="Nombre completo de la licenciatura o ingeniería"
                          value={otraCarrera}
                          onChange={(e) => setOtraCarrera(e.target.value)}
                          className="campo"
                          required
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-escuela" className="etiqueta">
                      {nivelAcademico === 'Media Superior'
                        ? 'Bachillerato'
                        : nivelAcademico === 'Egresado'
                          ? 'Carrera de egreso'
                          : 'Institución o dependencia de procedencia'}
                    </label>
                    <input
                      id="reg-escuela"
                      type="text"
                      maxLength={120}
                      placeholder={
                        nivelAcademico === 'Media Superior'
                          ? 'Ej. Bachillerato Técnico No. 1'
                          : 'Especifica plantel o institución'
                      }
                      value={escuelaLibre}
                      onChange={(e) => setEscuelaLibre(e.target.value)}
                      className="campo"
                      required
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-cuenta" className="etiqueta">
                    No. de cuenta UdeC
                  </label>
                  <input
                    id="reg-cuenta"
                    type="text"
                    maxLength={12}
                    placeholder="Ej. 20225104 o 0 si no aplica"
                    value={numeroCuenta}
                    onChange={(e) => setNumeroCuenta(e.target.value)}
                    className="campo tabular-nums"
                    required
                  />
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Nota: Escribe <strong className="tabular-nums">0</strong> si no aplica (externo).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={() => irAPaso(1)} className="btn-salvia">
                  Anterior
                </button>
                <button type="button" onClick={() => irAPaso(3)} className="btn-verde">
                  Siguiente
                </button>
              </div>
            </article>
          )}

          {/* PASO 3: Ficha de Emergencia */}
          {paso === 3 && (
            <article className="tarjeta flex flex-col gap-4 p-4">
              <h2 className="text-lg font-semibold text-tinta dark:text-noche-tinta">
                Ficha de Emergencia
              </h2>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-sangre" className="etiqueta">
                    Tipo de sangre
                  </label>
                  <select
                    id="reg-sangre"
                    value={tipoSangre}
                    onChange={(e) => setTipoSangre(e.target.value as TipoSangre)}
                    className="campo tabular-nums"
                  >
                    {TIPOS_SANGRE.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-alergias" className="etiqueta">
                    Alergias
                  </label>
                  <input
                    id="reg-alergias"
                    type="text"
                    maxLength={300}
                    placeholder="Ej. Penicilina, látex o Ninguna"
                    value={alergias}
                    onChange={(e) => setAlergias(e.target.value)}
                    className="campo"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-padecimientos" className="etiqueta">
                    Condiciones / medicamentos actuales
                  </label>
                  <textarea
                    id="reg-padecimientos"
                    rows={2}
                    maxLength={500}
                    placeholder="Indica condiciones relevantes o medicamentos actuales (o Ninguno)"
                    value={padecimientos}
                    onChange={(e) => setPadecimientos(e.target.value)}
                    className="campo min-h-20 py-2.5"
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-borde pt-3 dark:border-noche-borde">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-emerg-nom" className="etiqueta">
                      Nombre del contacto de emergencia
                    </label>
                    <input
                      id="reg-emerg-nom"
                      type="text"
                      maxLength={120}
                      placeholder="Nombre completo"
                      value={contactoEmergenciaNombre}
                      onChange={(e) => setContactoEmergenciaNombre(e.target.value)}
                      className="campo"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-emerg-par" className="etiqueta">
                      Parentesco
                    </label>
                    <input
                      id="reg-emerg-par"
                      type="text"
                      maxLength={60}
                      placeholder="Ej. Madre, Padre, Hermano(a), Pareja"
                      value={contactoEmergenciaParentesco}
                      onChange={(e) => setContactoEmergenciaParentesco(e.target.value)}
                      className="campo"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-emerg-tel" className="etiqueta">
                      Teléfono de emergencia
                    </label>
                    <input
                      id="reg-emerg-tel"
                      type="tel"
                      maxLength={20}
                      placeholder="10 dígitos"
                      value={contactoEmergenciaTelefono}
                      onChange={(e) => setContactoEmergenciaTelefono(e.target.value)}
                      className="campo tabular-nums"
                      required
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] leading-snug text-tinta-suave dark:text-noche-tinta-suave">
                Información declarada voluntariamente por el integrante únicamente como referencia
                en caso de emergencia.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => irAPaso(2)}
                  disabled={enviando}
                  className="btn-salvia"
                >
                  Anterior
                </button>
                <button type="submit" disabled={enviando} className="btn-naranja">
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </article>
          )}
        </form>
      </main>
    </div>
  )
}
