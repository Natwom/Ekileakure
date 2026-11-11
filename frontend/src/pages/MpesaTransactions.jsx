import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Undo2, X, Wallet, Banknote, TrendingUp, Search, AlertTriangle } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { mpesaApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

const fmt = (n) =>
  `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const when = (d) =>
  new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const tiles = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
}

const blankForm = { reference: '', amount: '', commission: '', customer_phone: '' }

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${tiles[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-navy mt-3">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === v ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'
          }`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function ConfirmReverseModal({ txn, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const canConfirm = reason.trim().length > 0 && !busy

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => { if (!busy) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverse-title"
    >
      <form
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (canConfirm) onConfirm(reason.trim()) }}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </span>
            <h2 id="reverse-title" className="text-lg font-bold text-navy">Reverse this transaction?</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            This will undo the effect on your float and cash and create a reversal record.
            This cannot be undone.
          </p>

          <dl className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Reference</dt>
              <dd className="font-semibold text-navy">{txn.reference}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Type</dt>
              <dd className="text-slate-700">{cap(txn.txn_type)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-bold text-navy">{fmt(txn.amount)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Commission</dt>
              <dd className="text-slate-700">{fmt(txn.commission)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Customer phone</dt>
              <dd className="text-slate-700">{txn.customer_phone || '—'}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Recorded</dt>
              <dd className="text-slate-700">{when(txn.created_at)}</dd>
            </div>
          </dl>

          <div>
            <label htmlFor="reverse-reason" className="text-xs font-medium text-slate-500">
              Reason for reversing<span className="text-red-500"> *</span>
            </label>
            <textarea id="reverse-reason" rows={2} autoFocus className="input mt-1"
              placeholder="e.g. Wrong amount entered"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={!canConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Reversing…' : 'Yes, reverse transaction'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function MpesaTransactions() {
  const { user } = useAuth()
  const canReverse = ['owner', 'manager'].includes(user.role)
  const [txns, setTxns] = useState([])
  const [state, setState] = useState(null)
  const [type, setType] = useState('deposit')
  const [form, setForm] = useState(blankForm)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [pending, setPending] = useState(null)   // transaction awaiting confirmation
  const [reversing, setReversing] = useState(false)

  const load = () => {
    mpesaApi.transactions()
      .then((r) => { setTxns(r.data); setLoaded(true) })
      .catch((err) => setMsg({ type: 'error', text: errorText(err, 'Failed to load transactions') }))
    mpesaApi.state().then((r) => setState(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    try {
      await mpesaApi.record({
        txn_type: type,
        reference: form.reference.trim(),
        amount: Number(form.amount) || 0,
        commission: Number(form.commission) || 0,
        customer_phone: form.customer_phone.trim() || null,
      })
      setForm(blankForm)
      setMsg({ type: 'success', text: `${cap(type)} ${form.reference.trim()} recorded.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to record transaction') })
    }
  }

  // Step 1: clicking the reverse icon only opens the confirmation prompt
  const askReverse = (t) => {
    setMsg({ type: '', text: '' })
    setPending(t)
  }

  // Step 2: the reversal only happens after the user confirms with a reason
  const confirmReverse = async (reason) => {
    if (!pending) return
    setReversing(true)
    try {
      await mpesaApi.reverse(pending.id, reason)
      setMsg({ type: 'success', text: `${pending.reference} was reversed. A reversal record was created.` })
      setPending(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to reverse transaction') })
      setPending(null)
    } finally {
      setReversing(false)
    }
  }

  const visible = txns.filter((t) => {
    if (filter === 'reversed') return t.status === 'reversed'
    if (filter !== 'all' && t.txn_type !== filter) return false
    if (q && !`${t.reference} ${t.customer_phone || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const isDeposit = type === 'deposit'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">M-Pesa Transactions</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          A deposit lowers float and raises cash. A withdrawal does the opposite. Only commission counts as income.
        </p>
      </div>

      {/* Balances */}
      {state && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Kpi icon={Wallet} tone="blue" label="Current float" value={fmt(state.current_float)}
            sub={`Opened the day with ${fmt(state.opening_float)}`} />
          <Kpi icon={Banknote} tone="amber" label="Physical cash" value={fmt(state.current_cash)}
            sub={`Opened the day with ${fmt(state.opening_cash)}`} />
          <Kpi icon={TrendingUp} tone="green" label="Commission today" value={fmt(state.today_commission)}
            sub={`Deposits ${fmt(state.today_deposits)}, withdrawals ${fmt(state.today_withdrawals)}`} />
        </div>
      )}

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

      {/* Record form */}
      <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-navy">Record a transaction</h2>
            <p className="text-sm text-slate-500">Enter it exactly as it appears on the M-Pesa message.</p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {['deposit', 'withdrawal'].map((t) => (
              <button type="button" key={t} onClick={() => setType(t)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  type === t
                    ? (t === 'deposit' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm')
                    : 'text-slate-500 hover:text-navy'
                }`}>
                {t === 'deposit' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                {cap(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="ref" className="text-xs font-medium text-slate-500">
              M-Pesa reference<span className="text-red-500"> *</span>
            </label>
            <input id="ref" required className="input mt-1 uppercase" placeholder="e.g. QK7X2H9P1L"
              value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div>
            <label htmlFor="amt" className="text-xs font-medium text-slate-500">
              Amount (KSh)<span className="text-red-500"> *</span>
            </label>
            <input id="amt" required type="number" min="1" step="0.01" className="input mt-1"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label htmlFor="comm" className="text-xs font-medium text-slate-500">Commission earned (KSh)</label>
            <input id="comm" type="number" min="0" step="0.01" className="input mt-1" placeholder="0"
              value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
          </div>
          <div>
            <label htmlFor="phone" className="text-xs font-medium text-slate-500">Customer phone</label>
            <input id="phone" className="input mt-1" placeholder="07XX XXX XXX"
              value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {isDeposit
              ? 'Customer hands you cash. Your float goes down and your cash goes up.'
              : 'Customer takes cash. Your float goes up and your cash goes down.'}
          </p>
          <button type="submit" className="btn-primary">Save {type}</button>
        </div>
      </form>

      {/* History */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-9" placeholder="Search by reference or phone"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={filter} onChange={setFilter}
            options={[['all', 'All'], ['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'], ['reversed', 'Reversed']]} />
        </div>

        <div className="overflow-x-auto">
          {loaded && visible.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-slate-400">
              {q || filter !== 'all'
                ? 'No transactions match these filters.'
                : 'No transactions yet. Record the first deposit or withdrawal above.'}
            </p>
          ) : (
            <DataTable
              columns={[
                { key: 'reference', label: 'Reference', render: (t) => <span className="font-medium text-navy">{t.reference}</span> },
                { key: 'txn_type', label: 'Type', render: (t) => (
                  <Badge tone={t.txn_type === 'deposit' ? 'green' : 'amber'}>
                    {t.txn_type === 'deposit'
                      ? <ArrowDownLeft size={12} className="mr-1 inline" />
                      : <ArrowUpRight size={12} className="mr-1 inline" />}
                    {cap(t.txn_type)}
                  </Badge>
                ) },
                { key: 'amount', label: 'Amount', render: (t) => (
                  <span className={`font-semibold ${t.status === 'reversed' ? 'text-slate-400 line-through' : 'text-navy'}`}>
                    {fmt(t.amount)}
                  </span>
                ) },
                { key: 'commission', label: 'Commission', render: (t) => (
                  <span className={Number(t.commission) < 0 ? 'text-red-600' : 'text-emerald-700'}>{fmt(t.commission)}</span>
                ) },
                { key: 'customer_phone', label: 'Phone', render: (t) => t.customer_phone || '—' },
                { key: 'operator_name', label: 'Operator', render: (t) => t.operator_name || '—' },
                { key: 'status', label: 'Status', render: (t) => (
                  t.status === 'verified' ? <Badge tone="green">Verified</Badge>
                  : t.status === 'pending' ? <Badge tone="amber">Pending</Badge>
                  : <Badge tone="red">Reversed</Badge>
                ) },
                { key: 'created_at', label: 'Time', render: (t) => <span className="text-slate-500">{when(t.created_at)}</span> },
                ...(canReverse ? [{
                  key: 'actions', label: '', render: (t) => (
                    t.status === 'verified' && (
                      <button onClick={() => askReverse(t)} className="text-slate-400 hover:text-red-600"
                        title="Reverse this transaction" aria-label="Reverse this transaction">
                        <Undo2 size={16} />
                      </button>
                    )
                  ),
                }] : []),
              ]}
              rows={visible}
            />
          )}
        </div>
      </div>

      {/* Confirmation prompt */}
      {pending && (
        <ConfirmReverseModal
          txn={pending}
          busy={reversing}
          onCancel={() => setPending(null)}
          onConfirm={confirmReverse}
        />
      )}
    </div>
  )
}