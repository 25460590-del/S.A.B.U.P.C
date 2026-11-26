import { useState } from 'react'
import { BarraEstado } from './components/BarraEstado'
import { BupcLogo } from './components/BupcLogo'
import { useSesion } from './context/SesionContext'
import { CuentaEnRevisionPage } from './pages/CuentaEnRevisionPage'
import { LoginPage } from './pages/LoginPage'
import { PanelActivoPage } from './pages/PanelActivoPage'
import { PerfilInactivoPage } from './pages/PerfilInactivoPage'
import { RegistroPage } from './pages/RegistroPage'
import { VerificacionCorreoPage } from './pages/VerificacionCorreoPage'
import { cerrarSesion } from './services/authService'

function PantallaCarga() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fondo dark:bg-noche">
      <BarraEstado etiquetaDerecha="Conectando..." />
      <header className="flex flex-col items-center gap-3 border-b-3 border-naranja bg-udec px-6 py-8 text-white">
        <BupcLogo tamano="lg" />
        <div className="h-5 w-32 animate-pulse rounded bg-white/25" />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="tarjeta flex flex-col gap-4 p-6">
          <div className="h-6 w-44 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const { usuarioAuth, perfil, perfilBloqueado, limpiarBloqueo } = useSesion()
  const [vistaPublica, setVistaPublica] = useState<'login' | 'registro'>('login')
  const [correoPrellenadoLogin, setCorreoPrellenadoLogin] = useState('')
  const [verificadoEnSesion, setVerificadoEnSesion] = useState(false)

  // 1. Bloqueo inmediato al pasar a Inactivo (listener global onSnapshot)
  if (perfilBloqueado) {
    return (
      <PerfilInactivoPage
        perfil={perfilBloqueado}
        alVolverALogin={() => {
          limpiarBloqueo()
          setVistaPublica('login')
        }}
      />
    )
  }

  // 2. Cargando sesión de Auth
  if (usuarioAuth === undefined) {
    return <PantallaCarga />
  }

  // 3. Sin sesión autenticada
  if (!usuarioAuth) {
    if (vistaPublica === 'registro') {
      return (
        <RegistroPage
          alVolverALogin={(correoSugerido) => {
            if (correoSugerido) setCorreoPrellenadoLogin(correoSugerido)
            setVistaPublica('login')
          }}
        />
      )
    }
    return (
      <LoginPage
        correoInicial={correoPrellenadoLogin}
        alIrARegistro={() => setVistaPublica('registro')}
      />
    )
  }

  // 4. Cargando expediente Firestore
  if (perfil === undefined) {
    return <PantallaCarga />
  }

  // 5. Recuperación automática de cuentas huérfanas (Auth sin documento en `usuarios/{uid}`)
  if (perfil === null) {
    return (
      <RegistroPage
        usuarioAutenticado={usuarioAuth}
        alVolverALogin={() => {
          void cerrarSesion()
          setVistaPublica('login')
        }}
      />
    )
  }

  // 6. Estatus Inactivo → Perfil Inactivo Bloqueado
  if (perfil.estatus === 'Inactivo') {
    return (
      <PerfilInactivoPage
        perfil={perfil}
        alVolverALogin={() => {
          void cerrarSesion()
          setVistaPublica('login')
        }}
      />
    )
  }

  // 7. Registro tradicional correo/contraseña pendiente de verificar correo
  if (!usuarioAuth.emailVerified && !verificadoEnSesion && perfil.estatus === 'Pendiente') {
    return (
      <VerificacionCorreoPage
        usuarioAuth={usuarioAuth}
        perfil={perfil}
        alConfirmarVerificacion={() => setVerificadoEnSesion(true)}
      />
    )
  }

  // 8. Estatus Pendiente → Cuenta en Revisión
  if (perfil.estatus === 'Pendiente') {
    return <CuentaEnRevisionPage perfil={perfil} />
  }

  // 9. Usuario activo (Brigadista, Encargado o Administrador) → Shell unificado RBAC aditivo
  return <PanelActivoPage perfil={perfil} />
}
