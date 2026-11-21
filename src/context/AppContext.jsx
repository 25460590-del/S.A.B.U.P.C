import { createContext, useContext, useState } from 'react'
import {
  INITIAL_HISTORY,
  INITIAL_LOGBOOK,
  INITIAL_OPERATIVOS,
  INITIAL_USERS,
} from '../data/mockData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [roleType, setRoleType] = useState('brigadista')
  const [operativos, setOperativos] = useState(INITIAL_OPERATIVOS)
  const [logbook, setLogbook] = useState(INITIAL_LOGBOOK)
  const [history, setHistory] = useState(INITIAL_HISTORY)

  // Global view-state preview mode so evaluators can test all mandatory states easily:
  // 'normal' | 'loading' | 'empty' | 'error'
  const [viewMode, setViewMode] = useState('normal')

  // Current active shift state for Scanner
  const [activeShift, setActiveShift] = useState({
    inService: true,
    operativoId: 'OP-2026-041',
    operativoName: 'Operativo Loromanía 2026',
    location: 'Estadio Olímpico Universitario',
    lastTime: '08:15:32',
    lastType: 'Entrada validada',
    rol: 'Primeros Auxilios',
    equipment: ['Radio', 'Chaleco'],
  })

  const currentUser = INITIAL_USERS[roleType]

  const loginAs = (selectedRole) => {
    setRoleType(selectedRole)
  }

  const recordScan = ({ operativoId, rol, equipment }) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const timeFull = `${hh}:${mm}:${ss}`
    const timeShort = `${hh}:${mm}`

    const nextInService = !activeShift.inService
    const targetOp =
      operativos.find((o) => o.id === (operativoId || activeShift.operativoId)) ||
      operativos[0]

    setActiveShift((prev) => ({
      ...prev,
      inService: nextInService,
      operativoId: targetOp.id,
      operativoName: targetOp.name,
      location: targetOp.location,
      lastTime: timeFull,
      lastType: nextInService ? 'Entrada validada' : 'Salida validada',
      rol: rol || prev.rol,
      equipment: equipment || prev.equipment,
    }))

    // Sync with logbook
    setLogbook((prev) => {
      const idx = prev.findIndex(
        (row) => row.matricula === currentUser.matricula && row.estado !== 'Turno finalizado'
      )
      if (!nextInService && idx !== -1) {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          salida: timeShort,
          horas: '3.5 hrs',
          estado: 'Turno finalizado',
          rol: rol || updated[idx].rol,
          equipo: equipment || updated[idx].equipo,
        }
        return updated
      }
      if (nextInService) {
        const newRow = {
          id: `log-${Date.now()}`,
          brigadista: currentUser.shortName,
          fullName: currentUser.name,
          matricula: currentUser.matricula,
          operativo: targetOp.name,
          operativoShort: targetOp.name.replace(' 2026', ''),
          category: targetOp.category,
          rol: rol || activeShift.rol,
          entrada: timeShort,
          salida: '—',
          horas: 'En curso',
          estado: 'En servicio',
          equipo: equipment || activeShift.equipment,
          observaciones: `Equipo reportado: ${(equipment || activeShift.equipment).join(', ') || 'Ninguno'}.`,
        }
        return [newRow, ...prev]
      }
      return prev
    })

    // Sync with personal history
    setHistory((prev) => {
      if (!nextInService && prev[0]?.isActive) {
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          isActive: false,
          hoursLabel: '3.5 hrs',
          dateRange: `20 Nov · 08:15 – ${timeShort} hrs`,
        }
        return updated
      }
      if (nextInService) {
        return [
          {
            id: `hist-${Date.now()}`,
            category: targetOp.category,
            categoryLabel: targetOp.categoryLabel,
            title: targetOp.name,
            dateRange: `20 Nov · ${timeShort} hrs — En curso`,
            rol: rol || activeShift.rol,
            hoursLabel: 'En servicio',
            isActive: true,
          },
          ...prev,
        ]
      }
      return prev
    })

    return { nextInService, timeFull, targetOp }
  }

  const updateShiftRole = (newRol) => {
    setActiveShift((prev) => ({ ...prev, rol: newRol }))
  }

  const updateShiftEquipment = (newEquip) => {
    setActiveShift((prev) => ({ ...prev, equipment: newEquip }))
  }

  const addOperativo = (newOp) => {
    setOperativos((prev) => [newOp, ...prev])
  }

  const updateOperativoQr = (opId, patch) => {
    setOperativos((prev) =>
      prev.map((op) =>
        op.id === opId
          ? {
              ...op,
              ...patch,
              status: patch.qrEnabled === false ? 'Pausado' : patch.qrEnabled === true ? 'QR Activo' : op.status,
            }
          : op
      )
    )
  }

  const updateLogObservation = (logId, text) => {
    setLogbook((prev) =>
      prev.map((row) => (row.id === logId ? { ...row, observaciones: text } : row))
    )
  }

  const closeLogShift = (logId) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setLogbook((prev) =>
      prev.map((row) =>
        row.id === logId
          ? {
              ...row,
              salida: `${hh}:${mm}`,
              horas: '4.0 hrs',
              estado: 'Turno finalizado',
            }
          : row
      )
    )
  }

  return (
    <AppContext.Provider
      value={{
        roleType,
        currentUser,
        loginAs,
        operativos,
        addOperativo,
        updateOperativoQr,
        logbook,
        updateLogObservation,
        closeLogShift,
        history,
        activeShift,
        recordScan,
        updateShiftRole,
        updateShiftEquipment,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
