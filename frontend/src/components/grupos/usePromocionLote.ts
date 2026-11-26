import { useMemo, useState, type FormEvent } from 'react'
import { ayudantiaEfectiva } from '../../lib/permisos'
import {
  mensajeDeError,
  nombreCompleto,
  promoverIntegrantesEnLote,
} from '../../services/authService'
import type { AyudantiaSlot, EtapaFormativa, Usuario } from '../../types'

export type SeleccionGrupoFormativo = {
  tipo: 'formativo'
  etapa: EtapaFormativa
  nombre: string
  cerrado: boolean
}

export type SeleccionGrupo =
  | SeleccionGrupoFormativo
  | { tipo: 'operativo'; ayudantia: Exclude<AyudantiaSlot, 'Ninguna'> }
  | { tipo: 'operativo_sin_ayudantia' }

interface UsePromocionLoteParams {
  actor: Usuario
  grupoAbierto: SeleccionGrupo | null
  integrantesGrupoAbierto: Usuario[]
  integrantesGestionables: Usuario[]
  gruposOmegaActivos: string[]
  alNotificar: (msg: string) => void
}

export function usePromocionLote({
  actor,
  grupoAbierto,
  integrantesGrupoAbierto,
  integrantesGestionables,
  gruposOmegaActivos,
  alNotificar,
}: UsePromocionLoteParams) {
  const [seleccionadosUids, setSeleccionadosUids] = useState<string[]>([])
  const [modalPromocionAbierto, setModalPromocionAbierto] = useState(false)
  const [subgrupoDestinoOmega, setSubgrupoDestinoOmega] = useState('')
  const [modoAyudantiaLote, setModoAyudantiaLote] = useState<'comun' | 'individual'>('comun')
  const [ayudantiaComun, setAyudantiaComun] = useState<AyudantiaSlot>('Socorros')
  const [ayudantiasIndividuales, setAyudantiasIndividuales] = useState<
    Record<string, AyudantiaSlot>
  >({})
  const [promoviendo, setPromoviendo] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  const seleccionadosEfectivos = useMemo(() => {
    const setGestionables = new Set(integrantesGestionables.map((u) => u.uid))
    return integrantesGrupoAbierto.filter(
      (u) => setGestionables.has(u.uid) && seleccionadosUids.includes(u.uid),
    )
  }, [integrantesGrupoAbierto, integrantesGestionables, seleccionadosUids])

  const seleccionadosSinAyudantia = useMemo(
    () => seleccionadosEfectivos.filter((u) => ayudantiaEfectiva(u) === 'Ninguna'),
    [seleccionadosEfectivos],
  )

  const todosSeleccionados =
    integrantesGestionables.length > 0 &&
    seleccionadosEfectivos.length === integrantesGestionables.length

  function reiniciarSeleccion() {
    setSeleccionadosUids([])
    setModalPromocionAbierto(false)
    setErrorModal(null)
  }

  function alternarSeleccion(uid: string) {
    setSeleccionadosUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    )
  }

  function alternarTodos() {
    if (todosSeleccionados) {
      setSeleccionadosUids([])
    } else {
      setSeleccionadosUids(integrantesGestionables.map((u) => u.uid))
    }
  }

  function abrirModalPromocion() {
    if (!grupoAbierto || grupoAbierto.tipo !== 'formativo' || seleccionadosEfectivos.length === 0) {
      return
    }
    setErrorModal(null)
    if (grupoAbierto.etapa === 'Alfa') {
      setSubgrupoDestinoOmega(gruposOmegaActivos[0] ?? '')
    } else {
      setModoAyudantiaLote('comun')
      setAyudantiaComun('Socorros')
      const mapaInicial: Record<string, AyudantiaSlot> = {}
      for (const u of seleccionadosSinAyudantia) {
        mapaInicial[u.uid] = 'Socorros'
      }
      setAyudantiasIndividuales(mapaInicial)
    }
    setModalPromocionAbierto(true)
  }

  async function manejarConfirmarPromocion(e: FormEvent) {
    e.preventDefault()
    if (!grupoAbierto || grupoAbierto.tipo !== 'formativo' || seleccionadosEfectivos.length === 0) {
      return
    }
    setErrorModal(null)

    const destinoEsOmega = grupoAbierto.etapa === 'Alfa'
    if (destinoEsOmega && !subgrupoDestinoOmega.trim()) {
      setErrorModal('Selecciona un grupo activo de Omega para recibir a los integrantes.')
      return
    }

    const ayudantiasPorUid: Record<string, AyudantiaSlot> = {}
    if (!destinoEsOmega) {
      for (const u of seleccionadosSinAyudantia) {
        const elegida =
          modoAyudantiaLote === 'comun'
            ? ayudantiaComun
            : (ayudantiasIndividuales[u.uid] ?? 'Ninguna')
        if (elegida === 'Ninguna') {
          setErrorModal(`Selecciona una ayudantía válida para ${nombreCompleto(u)}.`)
          return
        }
        ayudantiasPorUid[u.uid] = elegida
      }
    }

    setPromoviendo(true)
    try {
      const total = await promoverIntegrantesEnLote(actor, seleccionadosEfectivos, {
        etapaOrigen: grupoAbierto.etapa,
        grupoOrigen: grupoAbierto.nombre,
        etapaDestino: destinoEsOmega ? 'Omega' : 'Grupo Operativo',
        subgrupoDestino: destinoEsOmega ? subgrupoDestinoOmega.trim() : undefined,
        ayudantiasPorUid: destinoEsOmega ? undefined : ayudantiasPorUid,
      })

      const etiquetaDestino = destinoEsOmega ? subgrupoDestinoOmega.trim() : 'Grupo Operativo'
      alNotificar(
        `${total} integrante${total === 1 ? '' : 's'} promovido${total === 1 ? '' : 's'} de ${grupoAbierto.nombre} a ${etiquetaDestino}.`,
      )
      setSeleccionadosUids([])
      setModalPromocionAbierto(false)
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setPromoviendo(false)
    }
  }

  return {
    modalPromocionAbierto,
    setModalPromocionAbierto,
    subgrupoDestinoOmega,
    setSubgrupoDestinoOmega,
    modoAyudantiaLote,
    setModoAyudantiaLote,
    ayudantiaComun,
    setAyudantiaComun,
    ayudantiasIndividuales,
    setAyudantiasIndividuales,
    promoviendo,
    errorModal,
    seleccionadosEfectivos,
    seleccionadosSinAyudantia,
    todosSeleccionados,
    reiniciarSeleccion,
    alternarSeleccion,
    alternarTodos,
    abrirModalPromocion,
    manejarConfirmarPromocion,
  }
}
