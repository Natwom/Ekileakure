import { useEffect, useState } from 'react'
import { Search, RotateCcw, X, Receipt, Wallet, Undo2, AlertTriangle } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { salesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

const fmt = (n) => `KSh ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`

const when = (d) =>
  new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const paymentTone = { cash: 'green', mpesa: 'blue', card: 'amber' }
const paymentLabel = (m) => (m === 'mpesa' ? 'M-Pesa' : cap(m))

const tiles = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
}

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
        <button key={v} onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === v ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'
          }`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function ConfirmReturnModal({ sale, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const itemCount = (sale.items || []).reduce((n, i) => n + i.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => { if (!busy) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </span>
            <h2 id="return-title" className="text-lg font-bold text-navy">Return this sale?</h2>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            You are about to return the whole of this sale. All items will go back into stock
            and the sale will be marked as returned. This cannot be undone.
          </p>

          <dl className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Receipt</dt>
              <dd className="font-semibold text-navy">{sale.sale_no}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Date</dt>
              <dd className="text-slate-700">{when(sale.created_at)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Items</dt>
              <dd className="text-slate-700">{itemCount}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Payment</dt>
              <dd className="text-slate-700">{paymentLabel(sale.payment_method)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Amount to refund</dt>
              <dd className="font-bold text-navy">{fmt(sale.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60">
            {busy ? 'Returning…' : 'Yes, return sale'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SalesHistory() {
  const { user } = useAuth()
  const canReturn = ['owner', 'manager'].includes(user.role)
  const [sales, setSales] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(null)   // sale awaiting confirmation
  const [returning, setReturning] = useState(false)

  const load = () =>
    salesApi.list({ q: q || undefined })
      .then((r) => { setSales(r.data); setLoaded(true) })
      .catch((err) => setMsg({ type: 'error', text: errorText(err, 'Failed to load sales') }))

  useEffect(() => { load() }, [q])

  // Step 1: clicking the return icon only opens the confirmation prompt
  const askReturn = (s) => {
    setMsg({ type: '', text: '' })
    setPending(s)
  }

  // Step 2: the return only happens after the user confirms
  const confirmReturn = async () => {
    if (!pending) return
    setReturning(true)
    try {
      await salesApi.ret(pending.id)
      setMsg({ type: 'success', text: `${pending.sale_no} was returned and its stock restored.` })
      setPending(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to process the return') })
      setPending(null)
    } finally {
      setReturning(false)
    }
  }

  const visible = sales.filter(
    (s) => (status === 'all' || s.status === status) && (payment === 'all' || s.payment_method === payment)
  )

  const completed = sales.filter((s) => s.status === 'completed')
  const returned = sales.filter((s) => s.status !== 'completed')
  const revenue = completed.reduce((n, s) => n + Number(s.total || 0), 0)
  const returnedValue = returned.reduce((n, s) => n + Number(s.total || 0), 0)
  const average = completed.length ? revenue / completed.length : 0
  const filtering = q || status !== 'all' || payment !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Sales History</h1>
        <p className="text-sm text-slate-500 mt-0.5">Receipts, payments and returns</p>
      </div>

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi icon={Wallet} tone="blue" label="Revenue" value={fmt(revenue)}
          sub={`${completed.length} completed sale${completed.length === 1 ? '' : 's'}, average ${fmt(average)}`} />
        <Kpi icon={Receipt} tone="green" label="Sales loaded" value={sales.length}
          sub="Most recent receipts, newest first" />
        <Kpi icon={Undo2} tone={returned.length ? 'amber' : 'green'} label="Returned"
          value={returned.length} sub={returned.length ? `${fmt(returnedValue)} refunded` : 'No returns'} />
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

      {/* List */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-9" placeholder="Search by receipt number"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={status} onChange={setStatus}
            options={[['all', 'All'], ['completed', 'Completed'], ['returned', 'Returned']]} />
          <Segmented value={payment} onChange={setPayment}
            options={[['all', 'Any payment'], ['cash', 'Cash'], ['mpesa', 'M-Pesa']]} />
        </div>

        <div className="overflow-x-auto">
          {loaded && visible.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-slate-400">
              {filtering
                ? 'No sales match these filters.'
                : 'No sales yet. Completed sales from Point of Sale will show up here.'}
            </p>
          ) : (
            <DataTable
              columns={[
                { key: 'sale_no', label: 'Receipt', render: (s) => <span className="font-medium text-navy">{s.sale_no}</span> },
                { key: 'created_at', label: 'Date', render: (s) => <span className="text-slate-500">{when(s.created_at)}</span> },
                { key: 'items', label: 'Items', render: (s) => (s.items || []).reduce((n, i) => n + i.quantity, 0) },
                { key: 'payment_method', label: 'Payment', render: (s) => (
                  <Badge tone={paymentTone[s.payment_method] || 'slate'}>{paymentLabel(s.payment_method)}</Badge>
                ) },
                { key: 'discount', label: 'Discount', render: (s) => (
                  Number(s.discount) > 0 ? fmt(s.discount) : <span className="text-slate-300">—</span>
                ) },
                { key: 'total', label: 'Total', render: (s) => (
                  <span className={`font-semibold ${s.status === 'completed' ? 'text-navy' : 'text-slate-400 line-through'}`}>
                    {fmt(s.total)}
                  </span>
                ) },
                { key: 'status', label: 'Status', render: (s) => (
                  s.status === 'completed'
                    ? <Badge tone="green">Completed</Badge>
                    : <Badge tone="red">Returned</Badge>
                ) },
                ...(canReturn ? [{
                  key: 'actions', label: '', render: (s) => (
                    s.status === 'completed' && (
                      <button onClick={() => askReturn(s)} className="text-slate-400 hover:text-amber-600"
                        title="Return this sale" aria-label="Return this sale">
                        <RotateCcw size={16} />
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
        <ConfirmReturnModal
          sale={pending}
          busy={returning}
          onCancel={() => setPending(null)}
          onConfirm={confirmReturn}
        />
      )}
    </div>
  )
}