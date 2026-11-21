import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ScannerPage } from './pages/ScannerPage'
import { MyQrPage } from './pages/MyQrPage'
import { HistoryPage } from './pages/HistoryPage'
import { CommandCenterPage } from './pages/CommandCenterPage'
import { LogbookPage } from './pages/LogbookPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/escaner" element={<ScannerPage />} />
          <Route path="/mi-qr" element={<MyQrPage />} />
          <Route path="/historial" element={<HistoryPage />} />
          <Route path="/puesto-de-mando" element={<CommandCenterPage />} />
          <Route path="/bitacora" element={<LogbookPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
