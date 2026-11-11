import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-surface grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-navy text-white flex-col justify-between p-12">
        <div>
          <p className="text-2xl font-bold tracking-tight">EkileAkure</p>
          <p className="text-slate-400 text-sm mt-1">Business Management System</p>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">One Business.<br />Complete Control.</h1>
          <p className="mt-4 text-slate-300 max-w-md">
            Spare parts inventory, sales, purchases and M-Pesa agency operations — unified in one secure platform.
          </p>
          <div className="flex gap-6 mt-10">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <Wrench className="text-primary-500" />
              <div><p className="font-semibold text-sm">Spare Parts</p><p className="text-xs text-slate-400">Inventory & Sales</p></div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <Smartphone className="text-emerald-400" />
              <div><p className="font-semibold text-sm">M-Pesa Agency</p><p className="text-xs text-slate-400">Float & Commissions</p></div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">© 2026 EkileAkure</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <p className="text-2xl font-bold text-navy">EkileAkure</p>
            <p className="text-slate-500 text-sm">One Business. Complete Control.</p>
          </div>
          <div className="card p-8">
            <h2 className="text-xl font-bold text-navy">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Access your business dashboard</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-navy-soft">Email</label>
                <input className="input mt-1" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-navy-soft">Password</label>
                <input className="input mt-1" type="password" required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-2.5">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">
            Demo: owner@ekileakure.com / Owner@123
          </p>
        </div>
      </div>
    </div>
  )
}