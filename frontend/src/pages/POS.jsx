import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Minus, Trash2, Check, ShoppingCart,
  Banknote, Smartphone, CircleEllipsis, ScanBarcode, Printer,
} from 'lucide-react'
import Badge from '../components/Badge'
import { inventoryApi, salesApi } from '../api'
import { errorText } from '../utils/errors'

const fmt = (n) =>
  `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const methods = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { value: 'other', label: 'Other', icon: CircleEllipsis },
]

export default function POS() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState('cash')
  const [received, setReceived] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const loadProducts = (search) =>
    inventoryApi.products({ q: search || undefined })
      .then((r) => setProducts(r.data.filter((p) => p.quantity > 0)))
      .catch((err) => setError(errorText(err, 'Failed to load products')))

  useEffect(() => {
    const t = setTimeout(() => { loadProducts(q) }, 250)
    return () => clearTimeout(t)
  }, [q])

  const inCart = (id) => cart.find((i) => i.id === id)?.qty || 0

  const addToCart = (p) => {
    if (inCart(p.id) + 1 > p.quantity) {
      setError(`Only ${p.quantity} of ${p.name} available`)
      return
    }
    setError('')
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id)
      return existing
        ? prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { id: p.id, name: p.name, sku: p.sku, price: Number(p.selling_price), max: p.quantity, qty: 1 }]
    })
  }

  const changeQty = (item, delta) => {
    if (item.qty + delta > item.max) {
      setError(`Only ${item.max} of ${item.name} available`)
      return
    }
    setError('')
    setCart((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, qty: Math.max(i.qty + delta, 1) } : i))
    )
  }

  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.id !== id))

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart])
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const total = subtotal - disc
  const units = cart.reduce((n, i) => n + i.qty, 0)

  const receivedNum = Number(received)
  const change = receivedNum - total
  const shortCash = payment === 'cash' && received !== '' && receivedNum < total

  const completeSale = async () => {
    if (!cart.length || shortCash) return
    setBusy(true)
    setError('')
    try {
      const r = await salesApi.create({
        items: cart.map((i) => ({ product_id: i.id, quantity: i.qty, unit_price: i.price })),
        discount: disc,
        payment_method: payment,
      })
      setDone({ ...r.data, change: payment === 'cash' && received !== '' ? change : null })
      setCart([])
      setDiscount('')
      setReceived('')
      loadProducts(q)
    } catch (err) {
      setError(errorText(err, 'Sale failed'))
    } finally {
      setBusy(false)
    }
  }

  /* --------------------------- Sale complete --------------------------- */
  if (done) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="w-full max-w-sm">
          {/* Receipt-style card */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden">
            <div className="px-8 pt-8 pb-5 text-center border-b border-dashed border-slate-300">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full grid place-items-center mx-auto mb-4 ring-8 ring-emerald-50/60">
                <Check size={26} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-navy">Sale completed</h2>
              <p className="text-xs text-slate-400 mt-0.5">Receipt {done.sale_no}</p>
              <p className="text-4xl font-bold tracking-tight text-navy mt-4">{fmt(done.total)}</p>
              <p className="text-xs text-slate-500 mt-1 capitalize">{done.payment_method} payment</p>
            </div>
            {done.change !== null && done.change > 0 && (
              <div className="px-8 py-5 text-center bg-amber-50 border-b border-dashed border-amber-200">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Give change</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{fmt(done.change)}</p>
              </div>
            )}
            <div className="px-8 py-6 flex gap-3">
              <button className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={() => setDone(null)}>
                <Plus size={16} /> New sale
              </button>
              <button className="btn-ghost flex items-center justify-center gap-2"
                onClick={() => { setDone(null); navigate('/sales') }}>
                <Printer size={15} /> View sales
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            Stock levels have been updated automatically.
          </p>
        </div>
      </div>
    )
  }

  /* ------------------------------ Register ------------------------------ */
  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">

      {/* --------------------------- Product picker --------------------------- */}
      <div className="lg:col-span-3 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">Point of Sale</h1>
            <p className="text-sm text-slate-500 mt-0.5">Walk-in sales — no customer registration needed.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3.5 py-2">
            <ShoppingCart size={15} className="text-primary-600" />
            <span><strong className="text-navy">{units}</strong> unit{units === 1 ? '' : 's'} · <strong className="text-navy">{fmt(total)}</strong></span>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-11 !py-3.5 text-[15px] rounded-xl shadow-sm !border-slate-200 focus:!ring-primary-500"
            placeholder="Scan a barcode or search by name, SKU or part number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <ScanBarcode size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2.5 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" /> {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {products.map((p) => {
            const qty = inCart(p.id)
            const low = p.quantity <= p.min_stock
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className={`group relative rounded-2xl bg-white border p-4 text-left shadow-sm transition-all duration-150
                  hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600
                  ${qty ? 'border-primary-600 ring-1 ring-primary-600' : 'border-slate-200/80 hover:border-primary-300'}`}
              >
                {qty > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-primary-600 text-white text-xs font-bold grid place-items-center shadow-md">
                    {qty}
                  </span>
                )}
                <div className="h-9 w-9 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-primary-600 flex items-center justify-center mb-3 transition-colors">
                  <Plus size={17} />
                </div>
                <p className="font-medium text-navy text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {p.sku}{p.location && ` · ${p.location}`}
                </p>
                <div className="flex items-end justify-between mt-3">
                  <p className="text-base font-bold text-navy">{fmt(p.selling_price)}</p>
                  <Badge tone={low ? 'amber' : 'green'}>{p.quantity} left</Badge>
                </div>
              </button>
            )
          })}
          {products.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 py-14 text-center">
              <ScanBarcode size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm font-medium">
                {q ? 'No products match your search.' : 'No products in stock.'}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {q ? 'Try a different keyword or barcode.' : 'Receive stock via Purchases to get selling.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------- Cart ------------------------------- */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm lg:sticky lg:top-20 overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <h2 className="font-semibold text-navy flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                <ShoppingCart size={15} />
              </span>
              Current sale
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-1">
              {units} unit{units === 1 ? '' : 's'}
            </span>
          </div>

          <div className="px-5 py-2 max-h-[38vh] overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 && (
              <div className="py-12 text-center">
                <ShoppingCart size={26} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 text-sm">Cart is empty</p>
                <p className="text-slate-300 text-xs mt-1">Tap a product to add it to the sale.</p>
              </div>
            )}
            {cart.map((i) => (
              <div key={i.id} className="py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{i.name}</p>
                  <p className="text-xs text-slate-400">{fmt(i.price)} each</p>
                </div>
                <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white">
                  <button onClick={() => changeQty(i, -1)} disabled={i.qty <= 1}
                    className="w-8 h-8 grid place-items-center hover:bg-slate-100 disabled:opacity-30 transition-colors" aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{i.qty}</span>
                  <button onClick={() => changeQty(i, 1)}
                    className="w-8 h-8 grid place-items-center hover:bg-slate-100 transition-colors" aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-sm font-semibold text-navy w-24 text-right">{fmt(i.price * i.qty)}</p>
                <button onClick={() => removeItem(i.id)}
                  className="text-slate-300 hover:text-red-600 transition-colors" aria-label="Remove item">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Discount (KSh)</span>
              <input className="input !w-28 !py-1.5 text-right !bg-white" type="number" min="0" placeholder="0"
                value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
              <span className="font-semibold text-navy">Total due</span>
              <span className="text-[26px] leading-none font-bold tracking-tight text-navy">{fmt(total)}</span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {methods.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setPayment(value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                      payment === value
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-600/30'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-navy'
                    }`}>
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {payment === 'cash' && cart.length > 0 && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="text-slate-500" htmlFor="received">Cash received (KSh)</label>
                <input id="received" className="input !w-32 !py-1.5 text-right" type="number" min="0"
                  placeholder={String(Math.ceil(total))} value={received}
                  onChange={(e) => setReceived(e.target.value)} />
              </div>
            )}
            {payment === 'cash' && received !== '' && cart.length > 0 && (
              <div className={`flex justify-between rounded-xl px-4 py-2.5 text-sm font-semibold ${
                shortCash ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <span>{shortCash ? 'Short by' : 'Change due'}</span>
                <span className="text-base">{fmt(Math.abs(change))}</span>
              </div>
            )}

            <button
              disabled={!cart.length || busy || shortCash}
              onClick={completeSale}
              className="btn-primary w-full !py-3.5 text-[15px] font-semibold rounded-xl shadow-md shadow-primary-600/20
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:!bg-primary-700 transition-all"
            >
              {busy ? 'Processing…' : cart.length ? `Complete sale · ${fmt(total)}` : 'Complete sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}