import { useEffect, useState } from 'react'
import { Plus, Banknote } from 'lucide-react'
import DataTable from '../components/DataTable'
import { purchasingApi } from '../api'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [balances, setBalances] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [payFor, setPayFor] = useState(null)
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })

  const load = () => {
    purchasingApi.suppliers().then((r) => setSuppliers(r.data))
    purchasingApi.balances().then((r) => setBalances(r.data))
  }
  useEffect(load, [])

  const submit = async (e) => {
    e.preventDefault()
    await purchasingApi.createSupplier(form)
    setShowForm(false); setForm({ name: '', phone: '', email: '', address: '' })
    load()
  }

  const pay = async () => {
    await purchasingApi.pay(payFor.id, amount)
    setPayFor(null); setAmount('')
    load()
  }

  const balanceOf = (id) => Number(balances.find((b) => b.supplier_id === id)?.balance || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Suppliers</h1>
          <p className="text-sm text-slate-500">Manage supplier records and outstanding balances</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Supplier</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-slate-500">Name *</label>
            <input required className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-slate-500">Phone</label>
            <input className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-slate-500">Email</label>
            <input type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-slate-500">Address</label>
            <input className="input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="sm:col-span-2"><button className="btn-primary">Save Supplier</button></div>
        </form>
      )}

      {payFor && (
        <div className="card p-6 max-w-md">
          <h3 className="font-semibold text-navy">Record Payment — {payFor.name}</h3>
          <p className="text-sm text-slate-500">Outstanding: KSh {balanceOf(payFor.id).toLocaleString()}</p>
          <div className="mt-4 flex gap-3">
            <input className="input" type="number" min="0" step="0.01" placeholder="Amount (KSh)"
              value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <button className="btn-primary" onClick={pay} disabled={!amount}>Pay</button>
            <button className="btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable
          columns={[
            { key: 'name', label: 'Supplier', render: (s) => <span className="font-medium">{s.name}</span> },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'address', label: 'Address' },
            { key: 'balance', label: 'Outstanding', render: (s) => (
              <span className={balanceOf(s.id) > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                KSh {balanceOf(s.id).toLocaleString()}
              </span>
            ) },
            { key: 'actions', label: '', render: (s) => (
              <button onClick={() => setPayFor(s)} className="text-slate-400 hover:text-primary-600" title="Record payment">
                <Banknote size={16} />
              </button>
            ) },
          ]}
          rows={suppliers}
        />
      </div>
    </div>
  )
}