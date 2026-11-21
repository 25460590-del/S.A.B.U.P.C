import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Tema = 'claro' | 'oscuro'

interface EstadoTema {
  tema: Tema
  esOscuro: boolean
  alternarTema: () => void
}

const CLAVE_STORAGE = 'sabupc-tema'
const TemaContext = createContext<EstadoTema | null>(null)

function temaInicial(): Tema {
  const guardado = window.localStorage.getItem(CLAVE_STORAGE)
  if (guardado === 'claro' || guardado === 'oscuro') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
    window.localStorage.setItem(CLAVE_STORAGE, tema)
  }, [tema])

  return (
    <TemaContext.Provider
      value={{
        tema,
        esOscuro: tema === 'oscuro',
        alternarTema: () => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro')),
      }}
    >
      {children}
    </TemaContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema(): EstadoTema {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaProvider>')
  return ctx
}
