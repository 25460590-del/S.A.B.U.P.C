import type {
  AyudantiaSlot,
  EtapaBrigadista,
  GrupoOperativo,
  Operativo,
  Usuario,
} from '../types'

// ── Normalización y retrocompatibilidad v1.0 → v1.1 ──────────────────────────

export function normalizarClaveRadio(clave?: string | null): string {
  return (clave ?? '').trim().toUpperCase()
}

export function etapaDesdeGrupo(grupo?: GrupoOperativo | null): EtapaBrigadista {
  if (grupo === 'Alfa') return 'Alfa'
  if (grupo === 'Omega') return 'Omega'
  return 'Grupo Operativo'
}

export function grupoDesdeEtapa(etapa: EtapaBrigadista): GrupoOperativo {
  if (etapa === 'Alfa') return 'Alfa'
  if (etapa === 'Omega') return 'Omega'
  return 'Ninguno'
}

export function ayudantiaEfectiva(
  usuario: Pick<Usuario, 'ayudantia_slot'> & { ayudantia?: AyudantiaSlot },
): AyudantiaSlot {
  return usuario.ayudantia ?? usuario.ayudantia_slot ?? 'Ninguna'
}

export function etapaEfectiva(
  usuario: Pick<Usuario, 'grupo_operativo'> & { etapa?: EtapaBrigadista },
): EtapaBrigadista {
  return usuario.etapa ?? etapaDesdeGrupo(usuario.grupo_operativo)
}

/**
 * Normaliza un documento `usuarios/{uid}` leído de Firestore garantizando valores
 * por defecto seguros para documentos creados antes de v1.1.
 */
export function normalizarUsuario(raw: Usuario): Usuario {
  const etapa = raw.etapa ?? etapaDesdeGrupo(raw.grupo_operativo)
  const ayudantia = raw.ayudantia ?? raw.ayudantia_slot ?? 'Ninguna'
  const claveRadio = normalizarClaveRadio(raw.clave_radio || raw.clave_personal_radio)
  const subgrupo = typeof raw.subgrupo === 'string' ? raw.subgrupo : ''
  const parentescoEmergencia =
    typeof raw.contacto_emergencia_parentesco === 'string'
      ? raw.contacto_emergencia_parentesco.trim()
      : ''
  const gruposACargo = Array.isArray(raw.grupos_a_cargo)
    ? raw.grupos_a_cargo.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    : []

  return {
    ...raw,
    contacto_emergencia_parentesco: parentescoEmergencia,
    etapa,
    subgrupo,
    ayudantia,
    ayudantia_slot: raw.ayudantia_slot ?? ayudantia,
    grupos_a_cargo: gruposACargo,
    clave_radio: claveRadio,
    clave_personal_radio: raw.clave_personal_radio ?? (claveRadio ? claveRadio.slice(0, 10) : null),
  }
}

/**
 * Normaliza un documento `operativos/{id}` garantizando `estatus: 'Activo'`
 * cuando un operativo fue creado antes de v1.1.
 */
export function normalizarOperativo(raw: Operativo): Operativo {
  return {
    ...raw,
    estatus: raw.estatus ?? 'Activo',
  }
}

// ── RBAC estrictamente aditivo: Brigadista ⊂ Encargado ⊂ Administrador ───────

export function esUsuarioActivo(usuario?: Usuario | null): usuario is Usuario {
  return Boolean(usuario && usuario.estatus === 'Activo')
}

export function esAdmin(usuario?: Usuario | null): boolean {
  return esUsuarioActivo(usuario) && usuario.rol_sistema === 'Administrador'
}

/** Aditivo: tanto `Encargado` como `Administrador` activo cumplen `esEncargado`. */
export function esEncargado(usuario?: Usuario | null): boolean {
  return (
    esUsuarioActivo(usuario) &&
    (usuario.rol_sistema === 'Encargado' || usuario.rol_sistema === 'Administrador')
  )
}

/** Aditivo: `Administrador` o `Encargado` activo de Administración de Personal. */
export function esEncargadoAP(usuario?: Usuario | null): boolean {
  if (!esUsuarioActivo(usuario)) return false
  if (usuario.rol_sistema === 'Administrador') return true
  return usuario.rol_sistema === 'Encargado' && ayudantiaEfectiva(usuario) === 'Administración de Personal'
}

/** Aditivo: `Administrador` o `Encargado` activo de Tesla. */
export function esEncargadoTesla(usuario?: Usuario | null): boolean {
  if (!esUsuarioActivo(usuario)) return false
  if (usuario.rol_sistema === 'Administrador') return true
  return usuario.rol_sistema === 'Encargado' && ayudantiaEfectiva(usuario) === 'Tesla'
}

/**
 * Aditivo: ÚNICAMENTE `Administrador` hereda permiso de radio por defecto
 * sin depender de `autorizado_radio`. `Encargado` y `Brigadista` requieren `autorizado_radio === true`.
 */
export function puedeUsarRadio(usuario?: Usuario | null): boolean {
  if (!esUsuarioActivo(usuario)) return false
  return usuario.rol_sistema === 'Administrador' || usuario.autorizado_radio === true
}

/**
 * En campo (Operativos y Material BUPC), cualquier Encargado o Administrador activo
 * puede registrar asistencias, entregar/devolver material y levantar actas a cualquier brigadista.
 */
export function puedeOperarEnCampo(usuario?: Usuario | null): boolean {
  return esEncargado(usuario)
}

/**
 * Dominio exclusivo de TESLA + cero autoasignación de radio:
 * - Administrador activo puede editar `clave_radio` y `autorizado_radio`.
 * - Encargado Tesla activo puede editarlos ÚNICAMENTE en cuentas ajenas (`uid !== actor.uid`).
 * - AP, otros Encargados y Brigadistas nunca pueden editarlos.
 */
export function puedeAsignarRadio(actor?: Usuario | null, objetivo?: Usuario | null): boolean {
  if (!esUsuarioActivo(actor) || !objetivo) return false
  if (actor.rol_sistema === 'Administrador') return true
  return (
    actor.rol_sistema === 'Encargado' &&
    ayudantiaEfectiva(actor) === 'Tesla' &&
    actor.uid !== objetivo.uid
  )
}

export function perteneceAGruposACargo(actor: Usuario, objetivo: Usuario): boolean {
  const grupos = actor.grupos_a_cargo ?? []
  if (grupos.length === 0) return false
  const subgrupo = (objetivo.subgrupo ?? '').trim()
  const ayudantia = ayudantiaEfectiva(objetivo)
  const etapa = etapaEfectiva(objetivo)

  return (
    (subgrupo !== '' && subgrupo !== 'Ninguno' && grupos.includes(subgrupo)) ||
    (ayudantia !== 'Ninguna' && grupos.includes(ayudantia)) ||
    grupos.includes(etapa)
  )
}

/**
 * Gestión de personal (Opción B):
 * - Administrador: gestiona a cualquier cuenta.
 * - Encargado AP: gestiona a cualquier `Brigadista` (no a Encargados ni Administradores).
 * - Encargado normal: gestiona solo a `Brigadistas` dentro de sus `grupos_a_cargo`.
 */
export function puedeGestionarBrigadista(actor?: Usuario | null, objetivo?: Usuario | null): boolean {
  if (!esUsuarioActivo(actor) || !objetivo) return false
  if (actor.rol_sistema === 'Administrador') return true
  if (actor.rol_sistema !== 'Encargado') return false
  if (actor.uid === objetivo.uid) return false
  if (objetivo.rol_sistema !== 'Brigadista') return false
  if (ayudantiaEfectiva(actor) === 'Administración de Personal') return true
  return perteneceAGruposACargo(actor, objetivo)
}

export function puedeCambiarEstatusBrigadista(
  actor?: Usuario | null,
  objetivo?: Usuario | null,
): boolean {
  if (!esUsuarioActivo(actor) || !objetivo) return false
  if (actor.rol_sistema === 'Administrador') return true
  return (
    actor.rol_sistema === 'Encargado' &&
    ayudantiaEfectiva(actor) === 'Administración de Personal' &&
    actor.uid !== objetivo.uid &&
    objetivo.rol_sistema === 'Brigadista'
  )
}

export function puedeAdministrarCatalogos(actor?: Usuario | null): boolean {
  return esAdmin(actor)
}

export function puedeEliminarOperativo(actor?: Usuario | null): boolean {
  return esAdmin(actor)
}
