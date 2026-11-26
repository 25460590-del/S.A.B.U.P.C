import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ayudantiaJefatura, esAdmin, esEncargado } from '../lib/permisos'
import { escucharDirectorioSegunRol, mensajeDeError } from '../services/authService'
import type { Usuario } from '../types'

interface DirectorioContextValue {
  usuarios: Usuario[]
  cargando: boolean
  error: string | null
}

const DirectorioContext = createContext<DirectorioContextValue>({
  usuarios: [],
  cargando: false,
  error: null,
})

interface DirectorioProviderProps {
  perfil: Usuario
  children: ReactNode
}

/**
 * Proveedor de sesión única para el directorio de personal (Plan Spark · 4A M-8):
 * monta un único listener `escucharDirectorioSegunRol` por sesión autenticada para roles
 * que requieren directorio (Admin, Jefe de Ayudantía o Encargado con grupos a cargo),
 * evitando re-descargar toda la colección `usuarios` en cada cambio de pestaña.
 */
export function DirectorioProvider({ perfil, children }: DirectorioProviderProps) {
  const requiereDirectorio =
    esAdmin(perfil) ||
    Boolean(ayudantiaJefatura(perfil)) ||
    (esEncargado(perfil) && (perfil.grupos_a_cargo?.length ?? 0) > 0)

  const [estado, setEstado] = useState<{
    clave: string
    usuarios: Usuario[]
    cargando: boolean
    error: string | null
  }>({
    clave: '',
    usuarios: [],
    cargando: requiereDirectorio,
    error: null,
  })

  const claveAlcance = `${perfil.uid}|${perfil.rol_sistema}|${perfil.etapa}|${perfil.ayudantia}|${(perfil.grupos_a_cargo ?? []).join(',')}`

  useEffect(() => {
    if (!requiereDirectorio) return

    const cancelar = escucharDirectorioSegunRol(
      perfil,
      (lista) => {
        setEstado({
          clave: claveAlcance,
          usuarios: lista,
          cargando: false,
          error: null,
        })
      },
      (err) => {
        setEstado((prev) => ({
          clave: claveAlcance,
          usuarios: prev.clave === claveAlcance ? prev.usuarios : [],
          cargando: false,
          error: mensajeDeError(err),
        }))
      },
    )

    return cancelar
  }, [requiereDirectorio, claveAlcance, perfil])

  const valor = useMemo<DirectorioContextValue>(() => {
    if (!requiereDirectorio) {
      return { usuarios: [], cargando: false, error: null }
    }
    if (estado.clave !== claveAlcance) {
      return { usuarios: [], cargando: true, error: null }
    }
    return {
      usuarios: estado.usuarios,
      cargando: estado.cargando,
      error: estado.error,
    }
  }, [requiereDirectorio, estado, claveAlcance])

  return <DirectorioContext.Provider value={valor}>{children}</DirectorioContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirectorio(): DirectorioContextValue {
  return useContext(DirectorioContext)
}
