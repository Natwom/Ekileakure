import { useEffect, useState } from 'react'
import { Download, X, TrendingUp, Package, Smartphone } from 'lucide-react'
import { reportsApi } from '../api'
import { errorText } from '../utils/errors'

const n = (v) => Number(v || 0)
const fmt = (v) => `KSh ${n(v).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tone = (v) => (n(v) >= 0 ? 'text-emerald-700' : 'text-red-600')

function Line({ label, value, sign, total, result }) {
  return (
    <div className={`flex justify-between py-2.5 text-sm ${
      total ? 'border-t border-slate-200 mt-1 pt-3 font-semibold text-navy' : 'text-slate-600'
    }`}>
      <span>{label}</span>
      <span className={result ? tone(value) : ''}>{sign}{fmt(value)}</span>
    </div>
  )
}

function Card({ icon: Icon, title, tint, children }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${tint}`}><Icon size={18} /></span>
        <h2 className="font-semibold text-navy">{title}</h2>
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  )
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [report, setReport] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (from > to) { setMsg('The start date must be on or before the end date.'); return }
    setBusy(true)
    setMsg('')
    try {
      setReport((await reportsApi.profitLoss(from, to)).data)
    } catch (err) {
      setMsg(errorText(err, 'Failed to generate the report'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { run() }, [])

  const exportSales = async () => {
    setMsg('')
    try {
      const r = await reportsApi.exportSales(from, to)
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `sales_${from}_to_${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setMsg(errorText(err, 'Failed to export sales'))
    }
  }

  const sp = report?.spare_parts
  const mp = report?.mpesa
  const margin = sp && n(sp.revenue) > 0 ? (n(sp.gross_profit) / n(sp.revenue)) * 100 : null
  const period = `${new Date(from).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} to ${new Date(to).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Financial Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Profit and loss, with spare parts and M-Pesa kept apart. Transaction principal is never counted as revenue.
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="from" className="text-xs font-medium text-slate-500">From</label>
          <input id="from" type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="to" className="text-xs font-medium text-slate-500">To</label>
          <input id="to" type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={run} disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? 'Working…' : 'Generate report'}
        </button>
        <button onClick={exportSales} className="btn-ghost flex items-center gap-2 sm:ml-auto">
          <Download size={15} /> Export sales to Excel
        </button>
      </div>

      {msg && (
        <div className="flex items-start justify-between gap-3 rounded-xl px-4 py-2.5 text-sm border bg-red-50 text-red-700 border-red-200">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {!report && !msg && (
        <div className="h-48 rounded-2xl bg-slate-200 animate-pulse" />
      )}

      {report && (
        <>
          {/* Headline numbers */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-navy text-white p-5 shadow-sm sm:col-span-1">
              <p className="text-sm text-slate-300">Business net result</p>
              <p className={`text-3xl font-bold tracking-tight mt-3 ${n(report.total_net) < 0 ? 'text-red-300' : ''}`}>
                {fmt(report.total_net)}
              </p>
              <p className="text-xs text-slate-400 mt-1">{period}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <p className="text-sm text-slate-500">Spare parts net</p>
              <p className={`text-2xl font-bold tracking-tight mt-3 ${tone(sp.net)}`}>{fmt(sp.net)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {margin === null ? 'No sales in this period' : `${margin.toFixed(1)}% gross margin`}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <p className="text-sm text-slate-500">M-Pesa agency net</p>
              <p className={`text-2xl font-bold tracking-tight mt-3 ${tone(mp.net)}`}>{fmt(mp.net)}</p>
              <p className="text-xs text-slate-500 mt-1">Commission less division expenses</p>
            </div>
          </div>

          {/* Detail */}
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <Card icon={Package} title="Spare parts division" tint="bg-blue-50 text-blue-600">
              <Line label="Sales revenue" value={sp.revenue} />
              <Line label="Cost of goods sold" value={sp.cogs} sign="− " />
              <Line label="Gross profit" value={sp.gross_profit} total result />
              <Line label="Division expenses" value={sp.expenses} sign="− " />
              <Line label="Net result" value={sp.net} total result />
            </Card>

            <div className="space-y-4">
              <Card icon={Smartphone} title="M-Pesa agency division" tint="bg-emerald-50 text-emerald-600">
                <Line label="Agency commissions" value={mp.commissions} />
                <Line label="Division expenses" value={mp.expenses} sign="− " />
                <Line label="Net result" value={mp.net} total result />
              </Card>
              <Card icon={TrendingUp} title="Whole business" tint="bg-amber-50 text-amber-600">
                <Line label="Spare parts net" value={sp.net} result />
                <Line label="M-Pesa agency net" value={mp.net} result />
                <Line label="General expenses (not tied to a division)" value={report.general_expenses} sign="− " />
                <Line label="Business net result" value={report.total_net} total result />
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}