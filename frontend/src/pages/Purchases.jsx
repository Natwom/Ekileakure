import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, Truck, Wallet, AlertCircle, Trash2 } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { purchasingApi, inventoryApi } from '../api'
import { errorText } from '../utils/errors'

const fmt = (n) => `KSh ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
const money = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (d) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const blankLine = () => ({ product_id: '', quantity: 1, unit_cost: '' })
const blankForm = () => ({ supplier_id: '', invoice_no: '', paid: '', items: [blankLine()] })

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

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loaded, setLoaded] = useState(false)

  const load = () =>
    purchasingApi.list()
      .then((r) => { setPurchases(r.data); setLoaded(true) })
      .catch((err) => setMsg({ type: 'error', text: errorText(err, 'Failed to load purchases') }))

  useEffect(() => {
    load()
    purchasingApi.suppliers().then((r) => setSuppliers(r.data)).catch(() => {})
    inventoryApi.products({}).then((r) => setProducts(r.data)).catch(() => {})
  }, [])

  const setLine = (idx, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === idx ? { ...x, ...patch } : x)) }))
  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, blankLine()] }))
  const removeLine = (idx) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, j) => j !== idx) : f.items }))

  const lineTotal = (i) => (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0)
  const total = form.items.reduce((s, i) => s + lineTotal(i), 0)
  const paidNow = Number(form.paid) || 0
  const owingNow = total - paidNow

  const submit = async (e) => {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    if (paidNow > total) {
      setMsg({ type: 'error', text: 'Amount paid is more than the purchase total.' })
      return
    }
    try {
      await purchasingApi.create({
        supplier_id: Number(form.supplier_id),
        invoice_no: form.invoice_no.trim() || null,
        paid: paidNow,
        items: form.items.map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost) || 0,
        })),
      })
      setShowForm(false)
      setForm(blankForm())
      setMsg({ type: 'success', text: 'Purchase saved. The stock was added to inventory.' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to save purchase') })
    }
  }

  const totalBought = purchases.reduce((n, p) => n + Number(p.total || 0), 0)
  const totalPaid = purchases.reduce((n, p) => n + Number(p.paid || 0), 0)
  const outstanding = totalBought - totalPaid
  const unpaidCount = purchases.filter((p) => Number(p.total) - Number(p.paid) > 0).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Purchases</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stock received is added to inventory automatically</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Close form' : 'New purchase'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi icon={Truck} tone="blue" label="Total purchased" value={fmt(totalBought)}
          sub={`${purchases.length} purchase${purchases.length === 1 ? '' : 's'} recorded`} />
        <Kpi icon={Wallet} tone="green" label="Paid to suppliers" value={fmt(totalPaid)}
          sub="Amount settled so far" />
        <Kpi icon={AlertCircle} tone={outstanding > 0 ? 'amber' : 'green'} label="Still owed"
          value={fmt(outstanding)}
          sub={outstanding > 0 ? `${unpaidCount} purchase${unpaidCount === 1 ? '' : 's'} with a balance` : 'Nothing outstanding'} />
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

      {/* New purchase form */}
      {showForm && (
        <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-navy">New purchase</h2>
            <p className="text-sm text-slate-500">Choose the supplier, then list what you received.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="supplier" className="text-xs font-medium text-slate-500">
                  Supplier<span className="text-red-500"> *</span>
                </label>
                <select id="supplier" required className="input mt-1" value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">{suppliers.length ? 'Select a supplier' : 'No suppliers yet'}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    <Link to="/suppliers" className="underline">Add a supplier</Link> first, then come back.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="invoice" className="text-xs font-medium text-slate-500">Invoice number</label>
                <input id="invoice" className="input mt-1" value={form.invoice_no}
                  onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />
              </div>
              <div>
                <label htmlFor="paid" className="text-xs font-medium text-slate-500">Amount paid now (KSh)</label>
                <input id="paid" className="input mt-1" type="number" step="0.01" min="0" placeholder="0"
                  value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy mb-3">Items received</h3>
              <div className="hidden sm:grid grid-cols-12 gap-3 px-1 pb-1 text-xs font-medium text-slate-400">
                <span className="col-span-5">Product</span>
                <span className="col-span-2">Quantity</span>
                <span className="col-span-2">Unit cost</span>
                <span className="col-span-2 text-right">Line total</span>
                <span className="col-span-1" />
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center rounded-xl bg-slate-50 p-3">
                    <select required aria-label="Product" className="input col-span-12 sm:col-span-5"
                      value={item.product_id} onChange={(e) => setLine(idx, { product_id: e.target.value })}>
                      <option value="">{products.length ? 'Select a product' : 'No products yet'}</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input required type="number" min="1" step="1" aria-label="Quantity"
                      className="input col-span-4 sm:col-span-2" placeholder="Qty"
                      value={item.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                    <input required type="number" min="0" step="0.01" aria-label="Unit cost"
                      className="input col-span-4 sm:col-span-2" placeholder="0.00"
                      value={item.unit_cost} onChange={(e) => setLine(idx, { unit_cost: e.target.value })} />
                    <p className="col-span-3 sm:col-span-2 text-right text-sm font-semibold text-navy">
                      {money(lineTotal(item))}
                    </p>
                    <button type="button" onClick={() => removeLine(idx)} disabled={form.items.length === 1}
                      className="col-span-1 grid place-items-center text-slate-300 hover:text-red-600 disabled:opacity-30"
                      aria-label="Remove line">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLine} className="btn-ghost mt-3 !py-1.5 text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add another item
              </button>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-slate-500">Purchase total</p>
                <p className="text-xl font-bold text-navy">{fmt(total)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{owingNow < 0 ? 'Overpaid by' : 'Balance owed'}</p>
                <p className={`text-xl font-bold ${owingNow < 0 ? 'text-red-600' : owingNow > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {fmt(Math.abs(owingNow))}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setForm(blankForm()) }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">Save purchase</button>
            </div>
          </div>
        </form>
      )}

      {/* History */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-navy">Purchase history</h2>
        </div>
        <div className="overflow-x-auto">
          {loaded && purchases.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-slate-400">
              No purchases yet. Record one when a supplier delivers stock.
            </p>
          ) : (
            <DataTable
              columns={[
                { key: 'created_at', label: 'Date', render: (p) => <span className="text-slate-500">{when(p.created_at)}</span> },
                { key: 'supplier_name', label: 'Supplier', render: (p) => (
                  <span className="font-medium text-navy">{p.supplier_name || '—'}</span>
                ) },
                { key: 'invoice_no', label: 'Invoice', render: (p) => p.invoice_no || '—' },
                { key: 'items', label: 'Items', render: (p) => `${(p.items || []).reduce((n, i) => n + i.quantity, 0)} units` },
                { key: 'total', label: 'Total', render: (p) => <span className="font-semibold text-navy">{fmt(p.total)}</span> },
                { key: 'paid', label: 'Paid', render: (p) => <span className="text-slate-500">{fmt(p.paid)}</span> },
                { key: 'balance', label: 'Balance', render: (p) => {
                  const bal = Number(p.total) - Number(p.paid)
                  return bal > 0
                    ? <Badge tone="amber">{fmt(bal)} owed</Badge>
                    : <Badge tone="green">Settled</Badge>
                } },
                { key: 'status', label: 'Status', render: (p) => (
                  <Badge tone={p.status === 'received' ? 'green' : 'amber'}>{cap(p.status)}</Badge>
                ) },
              ]}
              rows={purchases}
            />
          )}
        </div>
      </div>
    </div>
  )
}