import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import POS from './pages/POS'
import SalesHistory from './pages/SalesHistory'
import Purchases from './pages/Purchases'
import Suppliers from './pages/Suppliers'
import MpesaTransactions from './pages/MpesaTransactions'
import MpesaFloat from './pages/MpesaFloat'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<ProtectedRoute roles={['owner','manager','spare_parts_cashier']}><POS /></ProtectedRoute>} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="sales" element={<SalesHistory />} />
        <Route path="purchases" element={<ProtectedRoute roles={['owner','manager','accountant']}><Purchases /></ProtectedRoute>} />
        <Route path="suppliers" element={<ProtectedRoute roles={['owner','manager','accountant']}><Suppliers /></ProtectedRoute>} />
        <Route path="mpesa" element={<ProtectedRoute roles={['owner','manager','mpesa_operator','accountant']}><MpesaTransactions /></ProtectedRoute>} />
        <Route path="mpesa-float" element={<ProtectedRoute roles={['owner','manager','mpesa_operator','accountant']}><MpesaFloat /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute roles={['owner','manager','accountant']}><Expenses /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['owner','manager','accountant']}><Reports /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['owner','manager']}><Users /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute roles={['owner']}><AuditLogs /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['owner']}><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}