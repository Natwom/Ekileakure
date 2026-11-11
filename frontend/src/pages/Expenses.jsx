import { useEffect, useState } from 'react'
import { Plus, Trash2, X, AlertTriangle } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { financeApi } from '../api'
import { errorText } from '../utils/errors'

const divisions = [
  { value: 'spare_parts', label: 'Spare Parts', tone: 'blue' },
  { value: 'mpesa', label: 'M-Pesa Agency', tone: 'green' },
  { value: 'general', label: 'General', tone: 'slate' },
]

const emptyForm = { division: 'general', category: '', amount: '', description: '' }

const divMeta = (d) => divisions.find((x) => x.value === d) || divisions[2]

function ConfirmDeleteModal({ expense, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => { if (!busy) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </span>
            <h2 id="delete-title" className="text-lg font-bold text-navy">Delete this expense?</h2>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            This will permanently remove the expense record. This cannot be undone.
          </p>

          <dl className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Date</dt>
              <dd className="text-slate-700">{new Date(expense.created_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <dt className="text-slate-500">Division</dt>
              <dd><Badge tone={divMeta(expense.division).tone}>{divMeta(expense.division).label}</Badge></dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Category</dt>
              <dd className="font-semibold text-navy">{expense.category}</dd>
            </div>
            <div className="flex justify-between gap-6 px-4 py-2.5">
              <dt className="text-slate-500">Description</dt>
              <dd className="text-slate-700 text-right">{expense.description || '—'}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-bold text-navy">KSh {Number(expense.amount).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
            {busy ? 'Deleting…' : 'Yes, delete expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)   // expense awaiting confirmation
  const [deleting, setDeleting] = useState(false)

  const load = () =>
    financeApi.expenses()
      .then((r) => setExpenses(r.data))
      .catch((err) => setError(errorText(err, 'Failed to load expenses')))

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await financeApi.createExpense({
        division: form.division,
        category: form.category.trim(),
        amount: Number(form.amount) || 0,
        description: form.description.trim() || null,
      })
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to save expense'))
    }
  }

  // Step 1: clicking the bin icon only opens the confirmation prompt
  const askDelete = (expense) => {
    setError('')
    setPending(expense)
  }

  // Step 2: the delete only happens after the user confirms
  const confirmDelete = async () => {
    if (!pending) return
    setDeleting(true)
    try {
      await financeApi.deleteExpense(pending.id)
      setPending(null)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to delete expense'))
      setPending(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Expenses</h1>
          <p className="text-sm text-slate-500">Business expenses by division</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Record Expense
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      {showForm && (
        <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Division</label>
            <select className="input mt-1" value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}>
              {divisions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Category *</label>
            <input required className="input mt-1" placeholder="e.g. Rent, Transport"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Amount (KSh) *</label>
            <input required type="number" min="0" step="0.01" className="input mt-1"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Description</label>
            <input className="input mt-1" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary">Save Expense</button>
          </div>
        </form>
      )}

      <div className="card">
        <DataTable
          columns={[
            { key: 'created_at', label: 'Date', render: (e) => new Date(e.created_at).toLocaleDateString() },
            { key: 'division', label: 'Division', render: (e) => {
              const m = divMeta(e.division)
              return <Badge tone={m.tone}>{m.label}</Badge>
            } },
            { key: 'category', label: 'Category', render: (e) => <span className="font-medium">{e.category}</span> },
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount', render: (e) => (
              <span className="font-semibold">KSh {Number(e.amount).toLocaleString()}</span>
            ) },
            { key: 'actions', label: '', render: (e) => (
              <button onClick={() => askDelete(e)} className="text-slate-400 hover:text-red-600"
                title="Delete this expense" aria-label="Delete this expense">
                <Trash2 size={16} />
              </button>
            ) },
          ]}
          rows={expenses}
        />
      </div>

      {/* Confirmation prompt */}
      {pending && (
        <ConfirmDeleteModal
          expense={pending}
          busy={deleting}
          onCancel={() => setPending(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}