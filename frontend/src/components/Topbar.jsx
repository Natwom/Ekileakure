import { Menu, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const roleLabels = {
  owner: 'Owner / Admin', manager: 'Manager',
  spare_parts_cashier: 'Spare Parts Cashier', mpesa_operator: 'M-Pesa Operator', accountant: 'Accountant',
}

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth()
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-20">
      <button onClick={onMenu} className="lg:hidden text-slate-500 hover:text-navy"><Menu size={22} /></button>
      <div className="flex-1" />
      <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
        <User size={16} />
        <span className="font-medium text-navy">{user?.full_name}</span>
        <span className="text-slate-400">·</span>
        <span>{roleLabels[user?.role]}</span>
      </div>
      <button onClick={logout} className="btn-ghost flex items-center gap-2 !py-1.5 text-sm">
        <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
      </button>
    </header>
  )
}