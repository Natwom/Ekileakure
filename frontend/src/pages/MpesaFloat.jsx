import { useEffect, useState } from 'react'
import { Lock, Wallet, Banknote, X, CheckCircle2 } from 'lucide-react'
import Badge from '../components/Badge'
import { mpesaApi } from '../api'
import { errorText } from '../utils/errors'

const fmt = (n) =>
  `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between py-2 text-sm border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${tone === 'in' ? 'text-emerald-700' : tone === 'out' ? 'text-red-600' : 'text-navy'}`}>
        {value}
      </span>
    </div>
  )
}

function Ledger({ icon: Icon, title, tone, current, children }) {
  const tile = tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${tile}`}><Icon size={18} /></span>
        <h2 className="font-semibold text-navy">{title}</h2>
      </div>
      <div className="px-5 py-2">{children}</div>
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-500">Current balance</span>
        <span className="text-2xl font-bold text-navy">{current}</span>
      </div>
    </div>
  )
}

function Variance({ label, expected, verified }) {
  if (verified === '') return null
  const diff = Number(verified) - expected
  const ok = Math.abs(diff) < 0.005
  return (
    <div className={`flex justify-between rounded-lg px-3 py-2 text-sm ${
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
    }`}>
      <span>{label}: expected {fmt(expected)}</span>
      <span className="font-semibold">
        {ok ? 'Matches' : `${diff > 0 ? 'Over' : 'Short'} by ${fmt(Math.abs(diff))}`}
      </span>
    </div>
  )
}

export default function MpesaFloat() {
  const [state, setState] = useState(null)
  const [form, setForm] = useState({ closing_float: '', closing_cash: '', other_in: '0', other_out: '0' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loadError, setLoadError] = useState('')

  const load = () =>
    mpesaApi.state()
      .then((r) => setState(r.data))
      .catch((err) => setLoadError(errorText(err, 'Failed to load balances')))

  useEffect(() => { load() }, [])

  const close = async (e) => {
    e.preventDefault()
    if (!confirm('Close the day? Verified balances become tomorrow\'s opening and this cannot be undone.')) return
    setMsg({ type: '', text: '' })
    try {
      await mpesaApi.closeDay({
        business_date: new Date().toISOString().slice(0, 10),
        closing_float: Number(form.closing_float) || 0,
        closing_cash: Number(form.closing_cash) || 0,
        other_in: Number(form.other_in) || 0,
        other_out: Number(form.other_out) || 0,
      })
      setMsg({ type: 'success', text: "Day closed. These balances will carry forward as tomorrow's opening." })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to close day') })
    }
  }

  if (loadError) {
    return (
      <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm max-w-xl">
        {loadError}
      </div>
    )
  }
  if (!state) {
    return (
      <div className="space-y-6 animate-pulse max-w-5xl">
        <div className="h-10 w-72 rounded-lg bg-slate-200" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-72 rounded-2xl bg-slate-200" />
          <div className="h-72 rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  const fm = state.float_movements || {}
  const cm = state.cash_movements || {}
  const closed = state.ledger_status === 'closed'
  const expectedFloat = Number(state.current_float || 0)
  const expectedCash = Number(state.current_cash || 0) + (Number(form.other_in) || 0) - (Number(form.other_out) || 0)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Cash and Float</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {closed
              ? "Today's books are closed. The verified balances carry forward automatically."
              : 'Count what you physically have, then close the day.'}
          </p>
        </div>
        <Badge tone={closed ? 'slate' : 'green'}>{closed ? 'Day closed' : 'Day open'}</Badge>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-2.5 text-sm border ${
          msg.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg({ type: '', text: '' })} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Ledgers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Ledger icon={Wallet} tone="blue" title="Electronic float" current={fmt(state.current_float)}>
          <Row label="Opening float" value={fmt(state.opening_float)} />
          <Row label="Added (withdrawals served)" value={`+ ${fmt(fm.deposits_in)}`} tone="in" />
          <Row label="Paid out (deposits served)" value={`− ${fmt(fm.withdrawals_out)}`} tone="out" />
        </Ledger>
        <Ledger icon={Banknote} tone="amber" title="Physical cash" current={fmt(state.current_cash)}>
          <Row label="Opening cash" value={fmt(state.opening_cash)} />
          <Row label="Received from deposits" value={`+ ${fmt(cm.deposits_in)}`} tone="in" />
          <Row label="Paid for withdrawals" value={`− ${fmt(cm.withdrawals_out)}`} tone="out" />
          <Row label="Other cash in" value={`+ ${fmt(cm.other_in)}`} tone="in" />
          <Row label="Other cash out" value={`− ${fmt(cm.other_out)}`} tone="out" />
        </Ledger>
      </div>

      {/* Close day */}
      {!closed && (
        <form onSubmit={close} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-navy flex items-center gap-2"><Lock size={18} /> Close the day</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Enter the amounts you counted. They become tomorrow's opening balances.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="cf" className="text-xs font-medium text-slate-500">
                  Counted float (KSh)<span className="text-red-500"> *</span>
                </label>
                <input id="cf" required type="number" step="0.01" className="input mt-1" value={form.closing_float}
                  onChange={(e) => setForm({ ...form, closing_float: e.target.value })} />
              </div>
              <div>
                <label htmlFor="cc" className="text-xs font-medium text-slate-500">
                  Counted cash (KSh)<span className="text-red-500"> *</span>
                </label>
                <input id="cc" required type="number" step="0.01" className="input mt-1" value={form.closing_cash}
                  onChange={(e) => setForm({ ...form, closing_cash: e.target.value })} />
              </div>
              <div>
                <label htmlFor="oi" className="text-xs font-medium text-slate-500">Other cash in (KSh)</label>
                <input id="oi" type="number" step="0.01" min="0" className="input mt-1" value={form.other_in}
                  onChange={(e) => setForm({ ...form, other_in: e.target.value })} />
              </div>
              <div>
                <label htmlFor="oo" className="text-xs font-medium text-slate-500">Other cash out (KSh)</label>
                <input id="oo" type="number" step="0.01" min="0" className="input mt-1" value={form.other_out}
                  onChange={(e) => setForm({ ...form, other_out: e.target.value })} />
              </div>
            </div>

            {(form.closing_float !== '' || form.closing_cash !== '') && (
              <div className="space-y-2">
                <Variance label="Float" expected={expectedFloat} verified={form.closing_float} />
                <Variance label="Cash" expected={expectedCash} verified={form.closing_cash} />
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-slate-400" />
              Any difference shown above is recorded as the closing balance.
            </p>
            <button type="submit" className="btn-primary">Close and carry forward</button>
          </div>
        </form>
      )}
    </div>
  )
}