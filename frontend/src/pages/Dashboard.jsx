import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBag, Package, AlertTriangle, Smartphone, TrendingUp, TrendingDown,
  Plus, Banknote, ArrowUpRight, Receipt, ArrowDownLeft, RefreshCw, Eye, EyeOff,
  Download, Search, X, Trophy, CalendarDays, Wallet, Keyboard,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { dashboardApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

/* -------------------------------- helpers --------------------------------- */

const AUTO_REFRESH_MS = 60_000
const HIDE_KEY = 'ea_dash_hide_amounts'

const fmtRaw = (n) =>
  `KSh ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`

const compact = (v) => {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const when = (d) =>
  new Date(d).toLocaleString('en-KE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

const clock = (d) =>
  d ? d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const paymentTone = { cash: 'green', mpesa: 'blue', card: 'amber' }
const paymentColor = { cash: '#10b981', mpesa: '#2563eb', card: '#f59e0b' }

const roleLabel = {
  owner: 'Administrator',
  manager: 'Manager',
  mpesa_operator: 'M-Pesa Operator',
  accountant: 'Accountant',
}

const pctChange = (cur, prev) => {
  const c = Number(cur) || 0
  const p = Number(prev) || 0
  if (p <= 0) return null
  return ((c - p) / p) * 100
}

const readHidden = () => {
  try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
}

/* --------------------------------- bits ----------------------------------- */

function Sparkline({ data, dataKey, color }) {
  return (
    <div className="h-10 w-24 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.75}
            fill={color} fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function Trend({ value }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      <Icon size={12} />
      {up ? '+' : ''}{Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(1)}%
    </span>
  )
}

const tones = {
  blue:  { chip: 'bg-blue-50 text-blue-600',       bar: 'from-blue-500 to-blue-300' },
  amber: { chip: 'bg-amber-50 text-amber-600',     bar: 'from-amber-500 to-amber-300' },
  green: { chip: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-500 to-emerald-300' },
  navy:  { chip: 'bg-navy/5 text-navy',            bar: 'from-slate-700 to-slate-400' },
}

function Kpi({ icon: Icon, label, value, sub, tone = 'blue', spark, sparkKey, sparkColor, trend }) {
  const t = tones[tone]
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5
      hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar} opacity-80`} />
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${t.chip}
          group-hover:scale-110 transition-transform`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[26px] leading-none font-bold tracking-tight text-navy truncate">{value}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Trend value={trend} />
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        </div>
        {spark?.length > 1 && <Sparkline data={spark} dataKey={sparkKey} color={sparkColor} />}
      </div>
    </div>
  )
}

function Panel({ title, sub, action, children, pad = false }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="font-semibold text-navy text-[15px]">{title}</h2>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={`overflow-x-auto flex-1 ${pad ? 'p-5' : ''}`}>{children}</div>
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-all ${
            value === o.value
              ? 'bg-white text-navy shadow-sm'
              : 'text-slate-500 hover:text-navy'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function IconBtn({ onClick, title, children, active = false, spin = false }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors ${
        active
          ? 'bg-white/20 border-white/20 text-white'
          : 'bg-white/10 hover:bg-white/15 border-white/10 text-slate-200'}`}>
      <span className={spin ? 'animate-spin' : ''}>{children}</span>
    </button>
  )
}

const Empty = ({ text }) => (
  <p className="px-5 py-12 text-center text-sm text-slate-400">{text}</p>
)

function MiniStat({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
      <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-navy truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-2xl bg-slate-200" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[136px] rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 h-96 rounded-2xl bg-slate-200" />
        <div className="h-96 rounded-2xl bg-slate-200" />
      </div>
    </div>
  )
}

/* --------------------------------- page ----------------------------------- */

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  const [hidden, setHidden] = useState(readHidden)
  const [range, setRange] = useState(14)
  const [metric, setMetric] = useState('both')
  const [saleQuery, setSaleQuery] = useState('')
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  /* data loading: first load, manual refresh and 60s auto refresh */
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const r = await dashboardApi.summary()
      setData(r.data)
      setUpdatedAt(new Date())
      setError('')
    } catch (err) {
      // keep showing the last good data on a failed background refresh
      if (!silent) setError(errorText(err, 'Failed to load dashboard'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  /* privacy toggle persisted */
  const toggleHidden = () =>
    setHidden((h) => {
      const next = !h
      try { localStorage.setItem(HIDE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })

  /* keyboard shortcuts: N = new sale, M = M-Pesa, R = refresh, H = hide amounts */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') navigate('/pos')
      else if (k === 'm') navigate('/mpesa')
      else if (k === 'r') load(true)
      else if (k === 'h') toggleHidden()
      else if (k === '?') setShowKeys((s) => !s)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, load])

  /* ---------------------------- derived values ----------------------------- */

  const money = useCallback((n) => (hidden ? 'KSh ••••' : fmtRaw(n)), [hidden])

  const fullChart = useMemo(() => data?.chart || [], [data])
  const chart = useMemo(() => fullChart.slice(-range), [fullChart, range])
  const recentSales = useMemo(() => data?.recent_sales || [], [data])
  const recentMpesa = useMemo(() => data?.recent_mpesa || [], [data])

  const stats = useMemo(() => {
    const salesTotal = chart.reduce((s, d) => s + (Number(d.sales) || 0), 0)
    const commTotal = chart.reduce((s, d) => s + (Number(d.commission) || 0), 0)
    const days = chart.length || 1
    let best = null
    chart.forEach((d) => {
      if (!best || (Number(d.sales) || 0) > (Number(best.sales) || 0)) best = d
    })
    return { salesTotal, commTotal, avg: salesTotal / days, best }
  }, [chart])

  const trends = useMemo(() => {
    const n = fullChart.length
    if (n < 2) return { sales: null, commission: null }
    const prev = fullChart[n - 2]
    return {
      sales: pctChange(data?.sales_today, prev.sales),
      commission: pctChange(data?.mpesa_commission_today, prev.commission),
    }
  }, [fullChart, data])

  const paymentMix = useMemo(() => {
    const map = {}
    recentSales.forEach((s) => {
      const k = s.payment_method || 'other'
      map[k] = (map[k] || 0) + (Number(s.total) || 0)
    })
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    return {
      total,
      rows: Object.entries(map)
        .map(([name, value]) => ({
          name, value, share: total ? (value / total) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
    }
  }, [recentSales])

  const filteredSales = useMemo(() => {
    const q = saleQuery.trim().toLowerCase()
    if (!q) return recentSales
    return recentSales.filter((s) =>
      [s.sale_no, s.payment_method, String(s.total)]
        .some((v) => String(v || '').toLowerCase().includes(q)))
  }, [recentSales, saleQuery])

  const exportCsv = () => {
    const header = 'Date,Sales (KSh),Commission (KSh)'
    const rows = chart.map((d) => `${d.date},${Number(d.sales) || 0},${Number(d.commission) || 0}`)
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ekileakure-performance-${range}d.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  /* ------------------------------ render states ---------------------------- */

  if (error && !data) {
    return (
      <div className="max-w-xl space-y-3">
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
        <button type="button" onClick={() => { setError(''); load(false) }}
          className="inline-flex items-center gap-2 rounded-xl bg-navy text-white px-4 py-2 text-sm font-medium hover:opacity-90">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    )
  }
  if (!data) return <Skeleton />

  const firstName = user?.full_name?.split(' ')[0] || ''
  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const role = roleLabel[user?.role] || 'Cashier'
  const lowStock = Number(data.low_stock) || 0
  const outOfStock = Number(data.out_of_stock) || 0
  const netMpesa = (Number(data.mpesa_deposits_today) || 0) - (Number(data.mpesa_withdrawals_today) || 0)
  const showSales = metric === 'both' || metric === 'sales'
  const showComm = metric === 'both' || metric === 'commission'

  const quickActions = [
    { to: '/pos', icon: ShoppingBag, title: 'New sale', desc: 'Open the point of sale', key: 'N', tint: 'bg-blue-50 text-blue-600', hover: 'hover:border-blue-300' },
    { to: '/mpesa', icon: Smartphone, title: 'Record M-Pesa', desc: 'Deposit or withdrawal', key: 'M', tint: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300' },
    { to: '/mpesa-float', icon: Banknote, title: 'Reconcile cash', desc: 'Close & verify today', tint: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-300' },
    { to: '/inventory', icon: Package, title: 'Check stock', desc: `${lowStock} low-stock item${lowStock === 1 ? '' : 's'}`, tint: 'bg-navy/5 text-navy', hover: 'hover:border-slate-400' },
  ]

  return (
    <div className="space-y-6">

      {/* ------------------------------ Hero banner ------------------------------ */}
      <div className="relative overflow-hidden rounded-2xl bg-navy text-white shadow-md">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative px-6 py-6 lg:px-8 flex flex-wrap items-center gap-6 justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
              <CalendarDays size={13} /> {today}
            </p>
            <h1 className="mt-1.5 text-2xl lg:text-[30px] font-bold tracking-tight">
              {greeting()}{firstName && `, ${firstName}`} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Here's how <span className="text-white font-medium">EkileAkure</span> is performing today
              <span className="mx-2 text-slate-600">·</span>
              <span className="text-slate-400">{role}</span>
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live · updated {clock(updatedAt)} · auto-refreshes every minute
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <IconBtn onClick={() => load(true)} title="Refresh (R)" spin={refreshing}>
              <RefreshCw size={16} />
            </IconBtn>
            <IconBtn onClick={toggleHidden} title={hidden ? 'Show amounts (H)' : 'Hide amounts (H)'} active={hidden}>
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconBtn>
            <IconBtn onClick={() => setShowKeys((s) => !s)} title="Keyboard shortcuts (?)" active={showKeys}>
              <Keyboard size={16} />
            </IconBtn>
            <Link to="/mpesa"
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2.5 text-sm font-medium transition-colors">
              <Smartphone size={16} className="text-emerald-400" /> Record M-Pesa
            </Link>
            <Link to="/pos"
              className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary-900/30 transition-colors">
              <Plus size={16} /> New Sale
            </Link>
          </div>
        </div>

        {showKeys && (
          <div className="relative border-t border-white/10 bg-white/5 px-6 lg:px-8 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
            {[['N', 'New sale'], ['M', 'Record M-Pesa'], ['R', 'Refresh'], ['H', 'Hide amounts'], ['?', 'Toggle this help']].map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-2">
                <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[11px] text-white">{k}</kbd> {l}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* background refresh failed notice (data still shown) */}
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2.5 text-sm">
          {error}
        </div>
      )}

      {/* ------------------------------ Low stock alert --------------------------- */}
      {lowStock > 0 && !alertDismissed && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
          <span className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-amber-600" />
          </span>
          <span>
            <strong>{lowStock}</strong> product{lowStock === 1 ? '' : 's'} at or below minimum stock
            {outOfStock > 0 && <> — <strong className="text-red-700">{outOfStock} out of stock</strong></>}
          </span>
          <Link to="/inventory"
            className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-900">
            Review inventory <ArrowUpRight size={14} />
          </Link>
          <button type="button" onClick={() => setAlertDismissed(true)} title="Dismiss"
            className="h-7 w-7 rounded-lg hover:bg-amber-100 flex items-center justify-center text-amber-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* --------------------------------- KPIs ---------------------------------- */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={ShoppingBag} label="Sales today" value={money(data.sales_today)}
          sub={`vs yesterday · Month ${money(data.sales_month)}`} tone="blue"
          trend={trends.sales} spark={fullChart} sparkKey="sales" sparkColor="#2563eb" />
        <Kpi icon={Package} tone="amber" label="Inventory value at cost"
          value={money(data.inventory_value)}
          sub={`${lowStock} low-stock item${lowStock === 1 ? '' : 's'}`} />
        <Kpi icon={Smartphone} tone="green" label="M-Pesa deposits today"
          value={money(data.mpesa_deposits_today)}
          sub={`Withdrawals · ${money(data.mpesa_withdrawals_today)}`} />
        <Kpi icon={TrendingUp} tone="navy" label="Commission today"
          value={money(data.mpesa_commission_today)} sub="Agency income"
          trend={trends.commission} spark={fullChart} sparkKey="commission" sparkColor="#10b981" />
      </div>

      {/* ---------------------------- Chart + payment mix ------------------------- */}
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-navy text-[15px]">Performance — last {range} days</h2>
              <p className="text-sm text-slate-500 mt-0.5">Shop sales vs. M-Pesa agency commission</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented value={range} onChange={setRange}
                options={[{ value: 7, label: '7D' }, { value: 14, label: '14D' }]} />
              <Segmented value={metric} onChange={setMetric}
                options={[
                  { value: 'both', label: 'Both' },
                  { value: 'sales', label: 'Sales' },
                  { value: 'commission', label: 'Commission' },
                ]} />
              <button type="button" onClick={exportCsv} disabled={chart.length === 0}
                title="Download as CSV"
                className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40">
                <Download size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 mb-3">
            <div>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Sales
              </p>
              <p className="font-semibold text-navy text-sm">{money(stats.salesTotal)}</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Commission
              </p>
              <p className="font-semibold text-navy text-sm">{money(stats.commTotal)}</p>
            </div>
          </div>

          <div className="h-72">
            {chart.length === 0 ? (
              <Empty text="No activity in this period yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => (hidden ? '•' : compact(v))} />
                  <Tooltip
                    formatter={(v) => money(v)}
                    contentStyle={{
                      borderRadius: 12, border: '1px solid #e2e8f0',
                      boxShadow: '0 8px 20px rgba(15,23,42,0.10)', fontSize: 13,
                    }}
                    labelStyle={{ fontWeight: 600, color: '#0f1e3d', marginBottom: 4 }}
                  />
                  {showSales && (
                    <Area type="monotone" dataKey="sales" name="Sales"
                      stroke="#2563eb" fill="url(#gSales)" strokeWidth={2.25} />
                  )}
                  {showComm && (
                    <Area type="monotone" dataKey="commission" name="Commission"
                      stroke="#10b981" fill="url(#gComm)" strokeWidth={2.25} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <MiniStat icon={Wallet} label="Avg daily sales" value={money(stats.avg)}
              sub={`Over ${chart.length || 0} day${chart.length === 1 ? '' : 's'}`}
              tint="bg-blue-50 text-blue-600" />
            <MiniStat icon={Trophy} label="Best day"
              value={stats.best ? money(stats.best.sales) : '—'}
              sub={stats.best ? stats.best.date : 'No data yet'}
              tint="bg-amber-50 text-amber-600" />
            <MiniStat icon={Smartphone} label="Net M-Pesa today"
              value={hidden ? 'KSh ••••' : `${netMpesa >= 0 ? '+' : '−'}${fmtRaw(Math.abs(netMpesa))}`}
              sub="Deposits minus withdrawals"
              tint="bg-emerald-50 text-emerald-600" />
          </div>
        </div>

        {/* Payment mix donut */}
        <Panel title="Payment mix" sub="Based on your latest sales" pad>
          {paymentMix.rows.length === 0 ? (
            <Empty text="Payment breakdown appears after your first sale." />
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMix.rows} dataKey="value" nameKey="name"
                      innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                      {paymentMix.rows.map((r) => (
                        <Cell key={r.name} fill={paymentColor[r.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Total</p>
                  <p className="text-lg font-bold text-navy">{money(paymentMix.total)}</p>
                </div>
              </div>
              <ul className="w-full mt-4 space-y-2.5">
                {paymentMix.rows.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: paymentColor[r.name] || '#94a3b8' }} />
                    <span className="font-medium text-navy">{cap(r.name)}</span>
                    <span className="ml-auto text-slate-500">{money(r.value)}</span>
                    <span className="w-12 text-right font-semibold text-navy">{r.share.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* ----------------------------- Recent activity ---------------------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Recent sales"
          sub="Latest completed point-of-sale transactions"
          action={(
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={saleQuery} onChange={(e) => setSaleQuery(e.target.value)}
                  placeholder="Search receipt…"
                  className="h-8 w-36 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs
                    placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/30 focus:bg-white" />
              </div>
              <Link to="/sales" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                View all <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
        >
          {recentSales.length === 0 ? (
            <Empty text="No sales yet. Ring up the first one in Point of Sale." />
          ) : filteredSales.length === 0 ? (
            <Empty text={`No sales match “${saleQuery}”.`} />
          ) : (
            <DataTable
              columns={[
                { key: 'sale_no', label: 'Receipt', render: (r) => (
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Receipt size={13} />
                    </span>
                    {r.sale_no}
                  </span>
                ) },
                { key: 'payment_method', label: 'Payment', render: (r) => (
                  <Badge tone={paymentTone[r.payment_method] || 'slate'}>{cap(r.payment_method)}</Badge>
                ) },
                { key: 'total', label: 'Total', render: (r) => (
                  <span className="font-semibold text-navy">{money(r.total)}</span>
                ) },
                { key: 'created_at', label: 'Time', render: (r) => (
                  <span className="text-slate-500">{when(r.created_at)}</span>
                ) },
              ]}
              rows={filteredSales}
            />
          )}
        </Panel>

        <Panel
          title="Recent M-Pesa transactions"
          sub="Deposits and withdrawals recorded today"
          action={(
            <Link to="/mpesa" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View all <ArrowUpRight size={14} />
            </Link>
          )}
        >
          {recentMpesa.length === 0 ? (
            <Empty text="No M-Pesa transactions recorded yet." />
          ) : (
            <DataTable
              columns={[
                { key: 'reference', label: 'Reference', render: (r) => (
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                      r.txn_type === 'deposit' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {r.txn_type === 'deposit'
                        ? <ArrowDownLeft size={13} />
                        : <ArrowUpRight size={13} />}
                    </span>
                    {r.reference}
                  </span>
                ) },
                { key: 'txn_type', label: 'Type', render: (r) => (
                  <Badge tone={r.txn_type === 'deposit' ? 'green' : 'amber'}>{cap(r.txn_type)}</Badge>
                ) },
                { key: 'amount', label: 'Amount', render: (r) => (
                  <span className="font-semibold text-navy">{money(r.amount)}</span>
                ) },
                { key: 'commission', label: 'Commission', render: (r) => (
                  <span className="text-emerald-700 font-medium">{money(r.commission)}</span>
                ) },
              ]}
              rows={recentMpesa}
            />
          )}
        </Panel>
      </div>

      {/* ----------------------------- Quick actions ------------------------------ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link key={a.to + a.title} to={a.to}
              className={`group rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${a.hover}`}>
              <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${a.tint}`}>
                <a.icon size={20} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-navy text-sm">{a.title}</p>
                <p className="text-xs text-slate-500 truncate">{a.desc}</p>
              </div>
              {a.key && (
                <kbd className="ml-auto hidden xl:inline rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                  {a.key}
                </kbd>
              )}
              <ArrowUpRight size={16}
                className={`${a.key ? '' : 'ml-auto'} text-slate-300 group-hover:text-navy transition-colors shrink-0`} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}