import { useEffect, useState } from 'react'
import { Plus, UserCheck, UserX, X, AlertTriangle } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { usersApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { errorText } from '../utils/errors'

const roleMeta = {
  owner: ['Owner / Admin', 'blue'],
  manager: ['Manager', 'blue'],
  spare_parts_cashier: ['Spare Parts Cashier', 'green'],
  mpesa_operator: ['M-Pesa Operator', 'amber'],
  accountant: ['Accountant', 'slate'],
}

const emptyForm = { full_name: '', email: '', password: '', role: 'spare_parts_cashier' }

function ConfirmStatusModal({ user, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const disabling = user.is_active
  const [roleLabel] = roleMeta[user.role] || [user.role]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => { if (!busy) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className={`h-10 w-10 rounded-full flex items-center justify-center ${
              disabling ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {disabling ? <AlertTriangle size={20} /> : <UserCheck size={20} />}
            </span>
            <h2 id="status-title" className="text-lg font-bold text-navy">
              {disabling ? 'Disable this user?' : 'Enable this user?'}
            </h2>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            {disabling
              ? 'This user will no longer be able to sign in. You can enable the account again at any time.'
              : 'This user will be able to sign in again with their existing details.'}
          </p>

          <dl className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-semibold text-navy">{user.full_name}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-700">{user.email}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Role</dt>
              <dd className="text-slate-700">{roleLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${
              disabling ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}>
            {busy
              ? (disabling ? 'Disabling…' : 'Enabling…')
              : (disabling ? 'Yes, disable user' : 'Yes, enable user')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)   // user awaiting confirmation
  const [updating, setUpdating] = useState(false)

  const load = () =>
    usersApi.list()
      .then((r) => setUsers(r.data))
      .catch((err) => setError(errorText(err, 'Failed to load users')))

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await usersApi.create(form)
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to create user'))
    }
  }

  // Step 1: clicking the icon only opens the confirmation prompt
  const askToggle = (u) => {
    setError('')
    if (u.id === me.id) {
      setError('You cannot disable your own account.')
      return
    }
    setPending(u)
  }

  // Step 2: the change only happens after the user confirms
  const confirmToggle = async () => {
    if (!pending) return
    setUpdating(true)
    try {
      await usersApi.update(pending.id, { is_active: !pending.is_active })
      setPending(null)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to update user'))
      setPending(null)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">User Management</h1>
          <p className="text-sm text-slate-500">Roles control access across both business divisions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      {showForm && (
        <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Full Name *</label>
            <input required className="input mt-1" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Email *</label>
            <input required type="email" className="input mt-1" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Password *</label>
            <input required type="password" minLength={8} className="input mt-1" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Role</label>
            <select className="input mt-1" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(roleMeta).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary">Create User</button>
          </div>
        </form>
      )}

      <div className="card">
        <DataTable
          columns={[
            { key: 'full_name', label: 'Name', render: (u) => <span className="font-medium">{u.full_name}</span> },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', render: (u) => {
              const [l, t] = roleMeta[u.role] || [u.role, 'slate']
              return <Badge tone={t}>{l}</Badge>
            } },
            { key: 'is_active', label: 'Status', render: (u) => (
              u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>
            ) },
            { key: 'actions', label: '', render: (u) => (
              <button onClick={() => askToggle(u)} className="text-slate-400 hover:text-navy"
                title={u.is_active ? 'Disable' : 'Enable'}
                aria-label={u.is_active ? 'Disable user' : 'Enable user'}>
                {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
              </button>
            ) },
          ]}
          rows={users}
        />
      </div>

      {/* Confirmation prompt */}
      {pending && (
        <ConfirmStatusModal
          user={pending}
          busy={updating}
          onCancel={() => setPending(null)}
          onConfirm={confirmToggle}
        />
      )}
    </div>
  )
}