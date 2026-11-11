import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Truck, Users,
  Smartphone, Wallet, Banknote, BarChart3, FileText, Settings,
  UserCog, ScrollText, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Point of Sale', icon: ShoppingCart, roles: ['owner','manager','spare_parts_cashier'] },
  { to: '/inventory', label: 'Inventory', icon: Package, roles: ['owner','manager','spare_parts_cashier','accountant'] },
  { to: '/sales', label: 'Sales History', icon: Receipt, roles: ['owner','manager','spare_parts_cashier','accountant'] },
  { to: '/purchases', label: 'Purchases', icon: Truck, roles: ['owner','manager','accountant'] },
  { to: '/suppliers', label: 'Suppliers', icon: Users, roles: ['owner','manager','accountant'] },
  { to: '/mpesa', label: 'M-Pesa Transactions', icon: Smartphone, roles: ['owner','manager','mpesa_operator','accountant'] },
  { to: '/mpesa-float', label: 'Cash & Float', icon: Wallet, roles: ['owner','manager','mpesa_operator','accountant'] },
  { to: '/expenses', label: 'Expenses', icon: Banknote, roles: ['owner','manager','accountant'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner','manager','accountant'] },
  { to: '/users', label: 'Users', icon: UserCog, roles: ['owner','manager'] },
  { to: '/audit', label: 'Audit Logs', icon: ScrollText, roles: ['owner'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner'] },
]

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const filtered = items.filter((i) => !i.roles || i.roles.includes(user?.role))
  return (
    <>
      {open && <div className="fixed inset-0 bg-navy/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-navy text-white flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <div>
            <p className="font-bold text-lg tracking-tight">EkileAkure</p>
            <p className="text-[11px] text-slate-400">Business Management</p>
          </div>
          <button className="lg:hidden text-slate-300" onClick={onClose}><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filtered.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-[11px] text-slate-400">
          One Business. Complete Control.
        </div>
      </aside>
    </>
  )
}