import { useEffect, useMemo, useState } from 'react'
import type { AyudantiaActiva } from '../../lib/permisos'
import {
  escucharAsistenciasDeOperativo,
  escucharPerfilesOperativosParaBitacora,
  escucharUsuariosParaBitacora,
} from '../../services/asistenciasService'
import { mensajeDeError } from '../../services/authService'
import { escucharEquiposDeOperativo } from '../../services/equiposService'
import { escucharPrerregistrosDeOperativo } from '../../services/prerregistrosService'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  PerfilOperativoMinimo,
  PrerregistroOperativo,
  Usuario,
} from '../../types'
import { etiquetaGrupoAsistencia, type FiltroEstadoBitacora } from './helpers'

interface UseBitacoraDatosParams {
  encargado: Usuario
  operativoId: string
  ayJefe: AyudantiaActiva | null
  busqueda: string
  filtroEstado: FiltroEstadoBitacora
  filtroGrupo: string
  filtroAyudantia: string
  busquedaPrerregistro: string
  alError: (msg: string) => void
}

export function useBitacoraDatos({
  encargado,
  operativoId,
  ayJefe,
  busqueda,
  filtroEstado,
  filtroGrupo,
  filtroAyudantia,
  busquedaPrerregistro,
  alError,
}: UseBitacoraDatosParams) {
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [prerregistros, setPrerregistros] = useState<PrerregistroOperativo[]>([])
  const [equipos, setEquipos] = useState<EquipoTurno[]>([])
  const [perfilesOperativos, setPerfilesOperativos] = useState<PerfilOperativoMinimo[]>([])
  const [perfilesCargados, setPerfilesCargados] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cancelarAsis = escucharAsistenciasDeOperativo(
      operativoId,
      (lista) => {
        setAsistencias(lista)
        setCargando(false)
      },
      (err) => {
        alError(mensajeDeError(err))
        setCargando(false)
      },
      ayJefe,
    )
    const cancelarPre = escucharPrerregistrosDeOperativo(
      operativoId,
      setPrerregistros,
      undefined,
      ayJefe,
    )
    const cancelarEq = escucharEquiposDeOperativo(
      operativoId,
      setEquipos,
      (err) => alError(mensajeDeError(err)),
      ayJefe,
    )
    const cancelarPerfiles = escucharPerfilesOperativosParaBitacora(
      encargado,
      (lista) => {
        setPerfilesOperativos(lista)
        setPerfilesCargados(true)
      },
      () => setPerfilesCargados(true),
    )
    const cancelarUsr = escucharUsuariosParaBitacora(encargado, setUsuarios, () => undefined)

    return () => {
      cancelarAsis()
      cancelarPre()
      cancelarEq()
      cancelarPerfiles()
      cancelarUsr()
    }
  }, [operativoId, encargado, ayJefe, alError])

  const mapaUsuarios = useMemo(() => new Map(usuarios.map((u) => [u.uid, u])), [usuarios])
  const mapaPerfiles = useMemo(
    () => new Map(perfilesOperativos.map((p) => [p.uid, p])),
    [perfilesOperativos],
  )
  const mapaPrerregistros = useMemo(
    () => new Map(prerregistros.map((p) => [p.usuario_uid, p])),
    [prerregistros],
  )

  const idsAsistenciasVisibles = useMemo(
    () => new Set(asistencias.map((a) => a.id)),
    [asistencias],
  )

  const equiposVisibles = useMemo(
    () => (ayJefe ? equipos.filter((eq) => idsAsistenciasVisibles.has(eq.asistencia_id)) : equipos),
    [equipos, ayJefe, idsAsistenciasVisibles],
  )

  const { uidsPrerregistrados, pendientesDeLlegar, confirmadosCount } = useMemo(() => {
    const uidsAsis = new Set(asistencias.map((a) => a.usuario_uid))
    const uidsPre = new Set(prerregistros.map((p) => p.usuario_uid))
    const pendientes: PrerregistroOperativo[] = []
    let confirmados = 0
    for (const p of prerregistros) {
      if (uidsAsis.has(p.usuario_uid)) {
        confirmados++
      } else if (!ayJefe || !perfilesCargados || mapaPerfiles.has(p.usuario_uid)) {
        pendientes.push(p)
      }
    }
    return {
      uidsPrerregistrados: uidsPre,
      pendientesDeLlegar: pendientes,
      confirmadosCount: confirmados,
    }
  }, [asistencias, prerregistros, ayJefe, perfilesCargados, mapaPerfiles])

  const { equiposBupcPorAsistencia, equiposPropiosPorAsistencia } = useMemo(() => {
    const mapaBupc = new Map<string, EquipoTurno[]>()
    const mapaPropios = new Map<string, EquipoTurno[]>()
    for (const eq of equiposVisibles) {
      const destino = eq.origen_material === 'Propio' ? mapaPropios : mapaBupc
      const lista = destino.get(eq.asistencia_id) ?? []
      lista.push(eq)
      destino.set(eq.asistencia_id, lista)
    }
    return { equiposBupcPorAsistencia: mapaBupc, equiposPropiosPorAsistencia: mapaPropios }
  }, [equiposVisibles])

  const gruposDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const a of asistencias) set.add(etiquetaGrupoAsistencia(a, mapaPerfiles))
    for (const p of prerregistros) set.add(p.subgrupo || p.etapa)
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'es-MX'))
  }, [asistencias, prerregistros, mapaPerfiles])

  const ayudantiasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const a of asistencias) set.add(a.ayudantia_slot)
    for (const p of prerregistros) set.add(p.ayudantia)
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'es-MX'))
  }, [asistencias, prerregistros])

  const conteos = useMemo(() => {
    let enTurno = 0
    let conAdeudo = 0
    let salidos = 0
    for (const a of asistencias) {
      if (a.hora_salida !== null) salidos++
      else enTurno++
      if (a.equipos_bupc_pendientes > 0) conAdeudo++
    }
    return {
      todos: asistencias.length,
      enTurno,
      conAdeudo,
      salidos,
      porLlegar: pendientesDeLlegar.length,
    }
  }, [asistencias, pendientesDeLlegar.length])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return asistencias.filter((a) => {
      if (filtroEstado === 'en_turno' && a.hora_salida !== null) return false
      if (filtroEstado === 'con_adeudo' && a.equipos_bupc_pendientes <= 0) return false
      if (filtroEstado === 'salidos' && a.hora_salida === null) return false

      const grupo = etiquetaGrupoAsistencia(a, mapaPerfiles)
      if (filtroGrupo !== 'TODOS' && grupo !== filtroGrupo) return false
      if (filtroAyudantia !== 'TODAS' && a.ayudantia_slot !== filtroAyudantia) return false

      if (!q) return true
      const p = mapaPerfiles.get(a.usuario_uid)
      const u = mapaUsuarios.get(a.usuario_uid)
      const claveRadio = (
        p?.clave_radio ||
        u?.clave_radio ||
        u?.clave_personal_radio ||
        ''
      ).toLowerCase()
      return (
        a.usuario_nombre.toLowerCase().includes(q) ||
        a.usuario_cuenta.toLowerCase().includes(q) ||
        a.rol_en_turno.toLowerCase().includes(q) ||
        grupo.toLowerCase().includes(q) ||
        claveRadio.includes(q)
      )
    })
  }, [asistencias, filtroEstado, filtroGrupo, filtroAyudantia, busqueda, mapaPerfiles, mapaUsuarios])

  const pendientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return pendientesDeLlegar.filter((p) => {
      const grupo = p.subgrupo || p.etapa
      if (filtroGrupo !== 'TODOS' && grupo !== filtroGrupo) return false
      if (filtroAyudantia !== 'TODAS' && p.ayudantia !== filtroAyudantia) return false
      if (!q) return true
      return (
        p.usuario_nombre.toLowerCase().includes(q) ||
        p.usuario_cuenta.toLowerCase().includes(q) ||
        grupo.toLowerCase().includes(q)
      )
    })
  }, [pendientesDeLlegar, filtroGrupo, filtroAyudantia, busqueda])

  const perfilesActivos = useMemo(
    () => perfilesOperativos.filter((p) => p.estatus === 'Activo'),
    [perfilesOperativos],
  )

  const candidatosPrerregistro = useMemo(() => {
    const q = busquedaPrerregistro.trim().toLowerCase()
    const uidsConAsis = new Set(asistencias.map((a) => a.usuario_uid))
    return perfilesActivos.filter((p) => {
      if (uidsPrerregistrados.has(p.uid) || uidsConAsis.has(p.uid)) return false
      if (!q) return true
      const grupo = (p.subgrupo || p.etapa || '').toLowerCase()
      return (
        p.nombre_completo.toLowerCase().includes(q) ||
        p.numero_cuenta.toLowerCase().includes(q) ||
        grupo.includes(q)
      )
    })
  }, [perfilesActivos, uidsPrerregistrados, asistencias, busquedaPrerregistro])

  return {
    asistencias,
    prerregistros,
    cargando,
    mapaUsuarios,
    mapaPerfiles,
    mapaPrerregistros,
    uidsPrerregistrados,
    pendientesDeLlegar,
    confirmadosCount,
    equiposBupcPorAsistencia,
    equiposPropiosPorAsistencia,
    gruposDisponibles,
    ayudantiasDisponibles,
    conteos,
    filtradas,
    pendientesFiltrados,
    perfilesActivos,
    candidatosPrerregistro,
  }
}
