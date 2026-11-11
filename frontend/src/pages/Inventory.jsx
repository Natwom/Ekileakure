import { useEffect, useState } from 'react'
import {
  Plus, Search, Archive, X, Package, Wallet, TrendingUp,
  AlertTriangle, Tag, Boxes,
} from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { inventoryApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

const emptyForm = {
  sku: '', part_number: '', name: '', brand: '', manufacturer: '',
  vehicle_compatibility: '', category_id: '', buying_price: '', selling_price: '',
  quantity: 0, min_stock: 5, location: '', barcode: '', description: '',
}

const text = (v) => (v === '' || v === undefined || v === null ? null : String(v).trim())
const int = (v, d = 0) => (v === '' || v === undefined || isNaN(Number(v)) ? d : parseInt(v, 10))
const dec = (v) => (v === '' || v === undefined || isNaN(Number(v)) ? 0 : Number(v))

const fmt = (n) => `KSh ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
const money = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sections = [
  {
    title: 'Product details',
    icon: Tag,
    fields: [
      ['sku', 'SKU', 'text', true], ['name', 'Product name', 'text', true],
      ['part_number', 'Part number', 'text'], ['brand', 'Brand', 'text'],
      ['manufacturer', 'Manufacturer', 'text'], ['vehicle_compatibility', 'Fits vehicles', 'text'],
    ],
  },
  {
    title: 'Pricing and stock',
    icon: Wallet,
    fields: [
      ['buying_price', 'Buying price (KSh)', 'number'], ['selling_price', 'Selling price (KSh)', 'number'],
      ['quantity', 'Opening quantity', 'number'], ['min_stock', 'Low-stock level', 'number'],
    ],
  },
  {
    title: 'Where to find it',
    icon: Boxes,
    fields: [['location', 'Shelf or location', 'text'], ['barcode', 'Barcode', 'text']],
  },
]

const tiles = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm
      hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${tiles[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="text-[26px] leading-none font-bold tracking-tight text-navy mt-4">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{sub}</p>
    </div>
  )
}

/* Stock indicator bar: green/amber/red fill relative to min_stock */
function StockBar({ p }) {
  const pct = p.min_stock > 0
    ? Math.min((p.quantity / (p.min_stock * 2)) * 100, 100)
    : (p.quantity > 0 ? 100 : 0)
  const color = p.quantity === 0 ? 'bg-red-500'
    : p.quantity <= p.min_stock ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Inventory() {
  const { user } = useAuth()
  const canEdit = ['owner', 'manager', 'spare_parts_cashier'].includes(user.role)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [valuation, setValuation] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loaded, setLoaded] = useState(false)

  const load = () => {
    const params = { q: q || undefined }
    if (filter === 'low') params.low_stock = true
    inventoryApi.products(params)
      .then((r) => { setProducts(r.data); setLoaded(true) })
      .catch((err) => setMsg({ type: 'error', text: errorText(err, 'Failed to load products') }))
    inventoryApi.valuation().then((r) => setValuation(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [q, filter])
  useEffect(() => {
    inventoryApi.categories().then((r) => setCategories(r.data)).catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    const payload = {
      sku: form.sku.trim(), name: form.name.trim(),
      part_number: text(form.part_number), brand: text(form.brand),
      manufacturer: text(form.manufacturer), vehicle_compatibility: text(form.vehicle_compatibility),
      description: text(form.description), location: text(form.location), barcode: text(form.barcode),
      category_id: form.category_id ? Number(form.category_id) : null,
      buying_price: dec(form.buying_price), selling_price: dec(form.selling_price),
      quantity: int(form.quantity, 0), min_stock: int(form.min_stock, 5),
    }
    try {
      await inventoryApi.create(payload)
      setShowForm(false); setForm(emptyForm)
      setMsg({ type: 'success', text: `${payload.name} was added to inventory.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to save product') })
    }
  }

  const archive = async (p) => {
    if (!confirm(`Archive "${p.name}"? It will no longer appear in Point of Sale.`)) return
    try {
      await inventoryApi.update(p.id, { is_active: false })
      setMsg({ type: 'success', text: `${p.name} was archived.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err, 'Failed to archive product') })
    }
  }

  const stockBadge = (p) =>
    p.quantity === 0 ? <Badge tone="red">Out of stock</Badge>
    : p.quantity <= p.min_stock ? <Badge tone="amber">Low stock</Badge>
    : <Badge tone="green">In stock</Badge>

  const lowCount = products.filter((p) => p.quantity <= p.min_stock).length
  const costValue = Number(valuation?.cost_value || 0)
  const retailValue = Number(valuation?.retail_value || 0)
  const margin = retailValue - costValue

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stock levels, prices and shelf locations</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm
              ${showForm ? 'btn-ghost' : 'btn-primary shadow-primary-600/20'}`}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Close form' : 'Add product'}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={Package} tone="blue" label="Products listed"
          value={products.length} sub={filter === 'low' ? 'Showing low stock only' : 'Active in the catalogue'} />
        <Kpi icon={Wallet} tone="amber" label="Stock value at cost"
          value={fmt(costValue)} sub="What the current stock cost you" />
        <Kpi icon={TrendingUp} tone="green" label="Stock value at retail"
          value={fmt(retailValue)} sub={`Potential margin ${fmt(margin)}`} />
        <Kpi icon={AlertTriangle} tone={lowCount ? 'red' : 'green'} label="Needs restocking"
          value={lowCount} sub={lowCount ? 'At or below the low-stock level' : 'Everything is above its level'} />
      </div>

      {/* Toast message */}
      {msg.text && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm border shadow-sm ${
          msg.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span className={`h-2 w-2 rounded-full shrink-0 ${msg.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg({ type: '', text: '' })} aria-label="Dismiss"
            className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Add product form */}
      {showForm && (
        <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-navy">New product</h2>
              <p className="text-xs text-slate-500 mt-0.5">SKU and product name are required — everything else can be added later.</p>
            </div>
            <span className="h-9 w-9 rounded-xl bg-primary-600 text-white flex items-center justify-center">
              <Package size={17} />
            </span>
          </div>
          <div className="p-6 space-y-7">
            {sections.map((s) => (
              <div key={s.title}>
                <div className="flex items-center gap-2 mb-3">
                  <s.icon size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-navy">{s.title}</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {s.fields.map(([key, label, type, required]) => (
                    <div key={key}>
                      <label htmlFor={key} className="text-xs font-medium text-slate-500">
                        {label}{required && <span className="text-red-500"> *</span>}
                      </label>
                      <input
                        id={key} className="input mt-1.5" type={type}
                        step={key === 'quantity' || key === 'min_stock' ? '1' : '0.01'}
                        min={type === 'number' ? '0' : undefined}
                        required={required} value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                  {s.title === 'Where to find it' && (
                    <div>
                      <label htmlFor="category_id" className="text-xs font-medium text-slate-500">Category</label>
                      <select id="category_id" className="input mt-1.5" value={form.category_id}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button type="submit" className="btn-primary">Save product</button>
            <button type="button" className="btn-ghost"
              onClick={() => { setShowForm(false); setForm(emptyForm) }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Product list */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-10 !py-2.5 rounded-xl !bg-slate-50 !border-transparent focus:!bg-white focus:!border-primary-500"
              placeholder="Search name, SKU, part number, brand or barcode…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[['all', 'All products'], ['low', 'Low stock']].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loaded && products.length === 0 ? (
            <div className="py-14 text-center">
              <Package size={28} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500 text-sm font-medium">
                {q || filter === 'low' ? 'No products match your search or filter.' : 'No products yet.'}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {q || filter === 'low' ? 'Try a different keyword.' : 'Add your first product to start tracking stock.'}
              </p>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Product', render: (p) => (
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                      <Package size={16} />
                    </span>
                    <div>
                      <p className="font-medium text-navy">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {p.sku}{p.part_number && ` · ${p.part_number}`}{p.brand && ` · ${p.brand}`}
                      </p>
                    </div>
                  </div>
                ) },
                { key: 'category_name', label: 'Category', render: (p) => (
                  p.category_name
                    ? <Badge tone="blue">{p.category_name}</Badge>
                    : <span className="text-slate-300">—</span>
                ) },
                { key: 'vehicle_compatibility', label: 'Fits', render: (p) => (
                  <span className="text-slate-500">{p.vehicle_compatibility || '—'}</span>
                ) },
                { key: 'quantity', label: 'Stock', render: (p) => (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy w-8">{p.quantity}</span>
                      {stockBadge(p)}
                    </div>
                    <StockBar p={p} />
                  </div>
                ) },
                { key: 'buying_price', label: 'Buy (KSh)', render: (p) => (
                  <span className="text-slate-500">{money(p.buying_price)}</span>
                ) },
                { key: 'selling_price', label: 'Sell (KSh)', render: (p) => (
                  <span className="font-semibold text-navy">{money(p.selling_price)}</span>
                ) },
                { key: 'location', label: 'Location', render: (p) => (
                  <span className="text-slate-500">{p.location || '—'}</span>
                ) },
                ...(canEdit ? [{
                  key: 'actions', label: '', render: (p) => (
                    <button onClick={() => archive(p)}
                      className="h-8 w-8 rounded-lg grid place-items-center text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Archive product" aria-label="Archive product">
                      <Archive size={15} />
                    </button>
                  ),
                }] : []),
              ]}
              rows={products}
            />
          )}
        </div>
      </div>
    </div>
  )
}