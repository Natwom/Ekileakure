import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Smartphone, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your details and try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-navy ' +
    'placeholder-slate-400 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'

  return (
    <div className="min-h-screen bg-surface grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          <p className="text-2xl font-bold tracking-tight">EkileAkure</p>
          <p className="mt-1 text-sm text-slate-400">Business Management System</p>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">
            One Business.<br />Complete Control.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Spare parts inventory, sales, purchases and M-Pesa agency operations, unified in one secure platform.
          </p>

          <div className="mt-10 flex gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <Wrench className="text-primary-500" />
              <div>
                <p className="text-sm font-semibold">Spare Parts</p>
                <p className="text-xs text-slate-400">Inventory & Sales</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <Smartphone className="text-emerald-400" />
              <div>
                <p className="text-sm font-semibold">M-Pesa Agency</p>
                <p className="text-xs text-slate-400">Float & Commissions</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-500">© 2026 EkileAkure</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-2xl font-bold text-navy">EkileAkure</p>
            <p className="text-sm text-slate-500">One Business. Complete Control.</p>
          </div>

          <div className="card p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-navy">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to access your business dashboard</p>

            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-navy-soft">Email</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    className={inputClass}
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@business.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-medium text-navy-soft">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    className={inputClass + ' pr-10'}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex w-full items-center justify-center gap-2 !py-2.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>

              {busy && (
                <p className="text-center text-xs text-slate-400">
                  The server may take a few seconds to wake up.
                </p>
              )}
            </form>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure, encrypted connection
          </p>
        </div>
      </div>
    </div>
  )
}
