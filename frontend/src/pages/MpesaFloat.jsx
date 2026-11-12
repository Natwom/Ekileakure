import { useEffect, useState } from 'react'
import {
  Lock, Wallet, Banknote, X, Landmark, Scale, AlertTriangle, RotateCcw, CheckCircle2,
} from 'lucide-react'
import Badge from '../components/Badge'
import { mpesaApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

const fmt = (n) =>
  `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// counted - expected  ->  balanced / surplus / shortage
const verdictOf = (counted, expected) => {
  const v = round2(Number(counted) - Number(expected))
  if (v === 0) return { kind: 'balanced', amount: 0 }
  return v > 0 ? { kind: 'surplus', amount: v } : { kind: 'shortage', amount: Math.abs(v) }
}

const bannerTone = {
  balanced: 'bg-slate-50 text-slate-700 border-slate-200',
  surplus: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  shortage: 'bg-red-50 text-red-700 border-red-200',
}
const textTone = { balanced: 'text-slate-500', surplus: 'text-emerald-600', shortage: 'text-red-600' }

const label = (v) =>
  v.kind === 'balanced' ? 'Balanced'
    : v.kind === 'surplus' ? `Surplus of ${fmt(v.amount)}`
    : `Shortage of ${fmt(v.amount)}`

// server verdicts look like { status, amount, signed }
const fromServer = (v) => ({ kind: v.status, amount: Number(v.amount) })

function Row({ label: l, value, tone }) {
  return (
    <div className="flex justify-between py-2 text-sm border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{l}</span>
      <span className={`font-medium ${tone === 'in' ? 'text-emerald-700' : tone === 'out' ? 'text-red-600' : 'text-navy'}`}>
        {value}
      </span>
    </div>
  )
}

function Ledger({ icon: Icon, title, tone, expected, children }) {
  const tile = tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${tile}`}><Icon size={18} /></span>
        <h2 className="font-semibold text-navy">{title}</h2>
      </div>
      <div className="px-5 py-2">{children}</div>
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-500">Expected balance</span>
        <span className="text-2xl font-bold text-navy">{fmt(expected)}</span>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, title, value, sub, tint }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${tint}`}><Icon size={18} /></span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-navy mt-3">{value}</p>
      {sub}
    </div>
  )
}

function VarianceBanner({ title, v }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${bannerTone[v.kind]}`}>
      <span>{title}</span>
      <span className="font-semibold">{label(v)}</span>
    </div>
  )
}

/* ---------------------------- first-time setup ---------------------------- */

function CapitalSetup({ onDone }) {
  const [form, setForm] = useState({ opening_float: '', opening_cash: '0', commission_in_float: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const total = (Number(form.opening_float) || 0) + (Number(form.opening_cash) || 0)

  const submit = async (e) => {
    e.preventDefault()
    if (!confirm(`Set your starting capital to ${fmt(total)}? Every future shortage or surplus is measured against this.`)) return
    setBusy(true); setErr('')
    try {
      await mpesaApi.setupCapital({
        opening_float: Number(form.opening_float) || 0,
        opening_cash: Number(form.opening_cash) || 0,
        commission_in_float: form.commission_in_float,
      })
      onDone()
    } catch (e2) {
      setErr(errorText(e2, 'Failed to save capital'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden max-w-2xl">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-navy flex items-center gap-2"><Landmark size={18} /> Set your starting capital</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Enter how your M-Pesa money is split right now. Float plus cash is your capital, and it should always add up.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {err && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2.5 text-sm">{err}</div>}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sf" className="text-xs font-medium text-slate-500">Electronic float (KSh)<span className="text-red-500"> *</span></label>
            <input id="sf" required type="number" min="0" step="0.01" className="input mt-1" value={form.opening_float}
              onChange={(e) => setForm({ ...form, opening_float: e.target.value })} />
          </div>
          <div>
            <label htmlFor="sc" className="text-xs font-medium text-slate-500">Physical cash (KSh)</label>
            <input id="sc" type="number" min="0" step="0.01" className="input mt-1" value={form.opening_cash}
              onChange={(e) => setForm({ ...form, opening_cash: e.target.value })} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-1" checked={form.commission_in_float}
            onChange={(e) => setForm({ ...form, commission_in_float: e.target.checked })} />
          <span>Commission is paid into my M-Pesa float (it raises the expected float)</span>
        </label>
        <p className="text-sm text-slate-500">Starting capital: <strong className="text-navy">{fmt(total)}</strong></p>
      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save capital'}</button>
      </div>
    </form>
  )
}

/* ---------------------------------- page ---------------------------------- */

export default function MpesaFloat() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ closing_float: '', closing_cash: '', other_in: '0', other_out: '0', note: '' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    mpesaApi.reconciliation()
      .then((r) => { setData(r.data); setLoadError('') })
      .catch((err) => setLoadError(errorText(err, 'Failed to load balances')))

  useEffect(() => { load() }, [])

  if (loadError) {
    return <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm max-w-xl">{loadError}</div>
  }
  if (!data) {
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

  /* first-time setup */
  if (!data.setup_done) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-navy">Cash and Float</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set your starting capital once, then reconcile every day.</p>
        </div>
        {isOwner
          ? <CapitalSetup onDone={load} />
          : <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-3 text-sm max-w-xl">
              The owner needs to set the starting capital before days can be reconciled.
            </div>}
      </div>
    )
  }

  const t = data.today
  const closed = t.status === 'closed'
  const capital = Number(data.settings.starting_capital)
  const cumulative = fromServer(data.cumulative)
  const closedToday = closed ? data.history.find((h) => h.date === t.date) : null

  const otherIn = Number(form.other_in) || 0
  const otherOut = Number(form.other_out) || 0
  const expFloat = Number(t.expected_float)
  const expCash = Number(t.expected_cash) + otherIn - otherOut
  const hasCounts = form.closing_float !== '' && form.closing_cash !== ''
  const fv = hasCounts ? verdictOf(form.closing_float, expFloat) : null
  const cv = hasCounts ? verdictOf(form.closing_cash, expCash) : null
  const tv = hasCounts ? verdictOf(Number(form.closing_float) + Number(form.closing_cash), expFloat + expCash) : null
  const needsNote = hasCounts && (fv.kind !== 'balanced' || cv.kind !== 'balanced')

  const close = async (e) => {
    e.preventDefault()
    if (!confirm("Close the day? The counted balances become tomorrow's opening and the result is recorded.")) return
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const r = await mpesaApi.closeDay({
        business_date: t.date,
        closing_float: Number(form.closing_float) || 0,
        closing_cash: Number(form.closing_cash) || 0,
        other_in: otherIn,
        other_out: otherOut,
        note: form.note.trim() || null,
      })
      const total = fromServer(r.data.total)
      setMsg({ type: total.kind === 'shortage' ? 'error' : 'success', text: `Day closed. ${label(total)}.` })
      setForm({ closing_float: '', closing_cash: '', other_in: '0', other_out: '0', note: '' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to close day') })
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    const reason = window.prompt('Why are you reopening today? (required)')
    if (!reason || !reason.trim()) return
    setMsg({ type: '', text: '' })
    try {
      await mpesaApi.reopenDay(reason.trim())
      setMsg({ type: 'success', text: 'Day reopened. Enter the correct counts and close it again.' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to reopen day') })
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Cash and Float</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {closed
              ? "Today is closed. The counted balances carry forward as tomorrow's opening."
              : 'Count your float and cash. Anything that does not add up to your capital shows below.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {closed && isOwner && (
            <button type="button" onClick={reopen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 text-sm font-medium">
              <RotateCcw size={14} /> Reopen
            </button>
          )}
          <Badge tone={closed ? 'slate' : 'green'}>{closed ? 'Day closed' : 'Day open'}</Badge>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-2.5 text-sm border ${
          msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg({ type: '', text: '' })} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Unclosed past day */}
      {data.unclosed_date && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>{data.unclosed_date}</strong> was never closed, so its movements are not included in today's opening balances.
            Ask the owner to check it before relying on today's numbers.
          </span>
        </div>
      )}

      {/* Capital + running position */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={Landmark} title="Starting capital" value={fmt(capital)} tint="bg-blue-50 text-blue-600"
          sub={<p className="text-xs text-slate-500 mt-1">Float + cash should add up to this</p>} />
        <Stat icon={Wallet} title="Expected total today" value={fmt(t.expected_total)} tint="bg-amber-50 text-amber-600"
          sub={<p className="text-xs text-slate-500 mt-1">
            {data.settings.commission_in_float ? `Capital + ${fmt(t.commission)} commission` : 'Capital, commission held separately'}
          </p>} />
        <Stat icon={Scale} title="Running position" value={label(cumulative)} tint={
          cumulative.kind === 'shortage' ? 'bg-red-50 text-red-600'
            : cumulative.kind === 'surplus' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}
          sub={<p className="text-xs text-slate-500 mt-1">Total across all closed days</p>} />
      </div>

      {/* Ledgers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Ledger icon={Wallet} tone="blue" title="Electronic float" expected={t.expected_float}>
          <Row label="Opening float" value={fmt(t.opening_float)} />
          <Row label="Added (withdrawals served)" value={`+ ${fmt(t.float_in)}`} tone="in" />
          <Row label="Paid out (deposits served)" value={`− ${fmt(t.float_out)}`} tone="out" />
          {data.settings.commission_in_float && (
            <Row label="Commission earned" value={`+ ${fmt(t.commission)}`} tone="in" />
          )}
        </Ledger>
        <Ledger icon={Banknote} tone="amber" title="Physical cash" expected={t.expected_cash}>
          <Row label="Opening cash" value={fmt(t.opening_cash)} />
          <Row label="Received from deposits" value={`+ ${fmt(t.cash_in)}`} tone="in" />
          <Row label="Paid for withdrawals" value={`− ${fmt(t.cash_out)}`} tone="out" />
          <Row label="Other cash in" value={`+ ${fmt(t.other_in)}`} tone="in" />
          <Row label="Other cash out" value={`− ${fmt(t.other_out)}`} tone="out" />
        </Ledger>
      </div>

      {/* Result of a closed day */}
      {closed && closedToday && (
        <div className="space-y-2">
          <VarianceBanner title="Float" v={fromServer(closedToday.float)} />
          <VarianceBanner title="Cash" v={fromServer(closedToday.cash)} />
          <VarianceBanner title="Overall" v={fromServer(closedToday.total)} />
          {closedToday.note && <p className="text-sm text-slate-500 px-1">Note: {closedToday.note}</p>}
        </div>
      )}

      {/* Close day */}
      {!closed && (
        <form onSubmit={close} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-navy flex items-center gap-2"><Lock size={18} /> Close the day</h2>
            <p className="text-sm text-slate-500 mt-0.5">Enter what you actually counted. We compare it to what you should have.</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="cf" className="text-xs font-medium text-slate-500">Counted float (KSh)<span className="text-red-500"> *</span></label>
                <input id="cf" required type="number" min="0" step="0.01" className="input mt-1" value={form.closing_float}
                  onChange={(e) => setForm({ ...form, closing_float: e.target.value })} />
              </div>
              <div>
                <label htmlFor="cc" className="text-xs font-medium text-slate-500">Counted cash (KSh)<span className="text-red-500"> *</span></label>
                <input id="cc" required type="number" min="0" step="0.01" className="input mt-1" value={form.closing_cash}
                  onChange={(e) => setForm({ ...form, closing_cash: e.target.value })} />
              </div>
              <div>
                <label htmlFor="oi" className="text-xs font-medium text-slate-500">Other cash in (KSh)</label>
                <input id="oi" type="number" min="0" step="0.01" className="input mt-1" value={form.other_in}
                  onChange={(e) => setForm({ ...form, other_in: e.target.value })} />
              </div>
              <div>
                <label htmlFor="oo" className="text-xs font-medium text-slate-500">Other cash out (KSh)</label>
                <input id="oo" type="number" min="0" step="0.01" className="input mt-1" value={form.other_out}
                  onChange={(e) => setForm({ ...form, other_out: e.target.value })} />
              </div>
            </div>

            {hasCounts && (
              <div className="space-y-2">
                <VarianceBanner title={`Float (expected ${fmt(expFloat)})`} v={fv} />
                <VarianceBanner title={`Cash (expected ${fmt(expCash)})`} v={cv} />
                <VarianceBanner title="Overall against your capital" v={tv} />
              </div>
            )}

            {needsNote && (
              <div>
                <label htmlFor="note" className="text-xs font-medium text-slate-500">
                  Explain the difference<span className="text-red-500"> *</span>
                </label>
                <textarea id="note" required rows={2} className="input mt-1"
                  placeholder="e.g. Customer short-changed, waiting for refund"
                  value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-slate-400" />
              Shortages and surpluses are recorded, not absorbed.
            </p>
            <button type="submit" disabled={busy || !hasCounts} className="btn-primary disabled:opacity-60">
              {busy ? 'Closing…' : 'Close and carry forward'}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-navy">Closed days</h2>
          <p className="text-xs text-slate-500 mt-0.5">Expected against counted, with the shortage or surplus for each day</p>
        </div>
        {data.history.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No closed days yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Expected</th>
                  <th className="px-5 py-3 font-medium">Counted</th>
                  <th className="px-5 py-3 font-medium">Float</th>
                  <th className="px-5 py-3 font-medium">Cash</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => {
                  const tot = fromServer(h.total)
                  const fl = fromServer(h.float)
                  const ca = fromServer(h.cash)
                  return (
                    <tr key={h.date} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-navy whitespace-nowrap">{h.date}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{fmt(h.expected_total)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{fmt(h.counted_total)}</td>
                      <td className={`px-5 py-3 whitespace-nowrap ${textTone[fl.kind]}`}>{label(fl)}</td>
                      <td className={`px-5 py-3 whitespace-nowrap ${textTone[ca.kind]}`}>{label(ca)}</td>
                      <td className={`px-5 py-3 whitespace-nowrap font-semibold ${textTone[tot.kind]}`}>{label(tot)}</td>
                      <td className="px-5 py-3 text-slate-500">{h.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}