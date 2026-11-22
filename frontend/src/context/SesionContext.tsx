import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth } from '../lib/firebase'
import {
  esAdmin,
  esEncargado,
  esEncargadoAP,
  esEncargadoTesla,
  puedeOperarEnCampo,
  puedeUsarRadio,
} from '../lib/permisos'
import { escucharPerfil } from '../services/authService'
import type { Usuario } from '../types'

export interface PermisosSesion {
  esAdmin: boolean
  esEncargado: boolean
  esEncargadoAP: boolean
  esEncargadoTesla: boolean
  puedeUsarRadio: boolean
  puedeOperarEnCampo: boolean
}

interface EstadoSesion {
  /** `undefined` = resolviendo sesión. */
  usuarioAuth: User | null | undefined
  /** `undefined` = cargando, `null` = sin expediente. */
  perfil: Usuario | null | undefined
  /** Perfil que fue dado de baja mientras tenía sesión (pantalla roja). */
  perfilBloqueado: Usuario | null
  limpiarBloqueo: () => void
  /** Permisos RBAC aditivos derivados del perfil actual. */
  permisos: PermisosSesion
}

const SesionContext = createContext<EstadoSesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuarioAuth, setUsuarioAuth] = useState<User | null | undefined>(undefined)
  const [perfil, setPerfil] = useState<Usuario | null | undefined>(undefined)
  const [perfilBloqueado, setPerfilBloqueado] = useState<Usuario | null>(null)

  useEffect(() => {
    let dejarDeEscuchar: (() => void) | undefined

    const cancelarAuth = onAuthStateChanged(auth, (user) => {
      dejarDeEscuchar?.()
      dejarDeEscuchar = undefined
      setUsuarioAuth(user)
      setPerfil(undefined)
      if (!user) return

      // Listener global: si el expediente pasa a Inactivo, se bloquea la sesión al instante.
      const cancelar = escucharPerfil(
        user.uid,
        (datos) => {
          if (datos?.estatus === 'Inactivo') {
            cancelar()
            dejarDeEscuchar = undefined
            setPerfilBloqueado(datos)
            void signOut(auth)
            return
          }
          setPerfil(datos)
        },
        () => setPerfil(null),
      )
      dejarDeEscuchar = cancelar
    })

    return () => {
      dejarDeEscuchar?.()
      cancelarAuth()
    }
  }, [])

  const permisos = useMemo<PermisosSesion>(
    () => ({
      esAdmin: esAdmin(perfil),
      esEncargado: esEncargado(perfil),
      esEncargadoAP: esEncargadoAP(perfil),
      esEncargadoTesla: esEncargadoTesla(perfil),
      puedeUsarRadio: puedeUsarRadio(perfil),
      puedeOperarEnCampo: puedeOperarEnCampo(perfil),
    }),
    [perfil],
  )

  return (
    <SesionContext.Provider
      value={{
        usuarioAuth,
        perfil,
        perfilBloqueado,
        limpiarBloqueo: () => setPerfilBloqueado(null),
        permisos,
      }}
    >
      {children}
    </SesionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSesion(): EstadoSesion {
  const ctx = useContext(SesionContext)
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return ctx
}
