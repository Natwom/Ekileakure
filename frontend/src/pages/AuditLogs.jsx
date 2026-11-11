import { useEffect, useState } from 'react'
import DataTable from '../components/DataTable'
import client from '../api/client'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  useEffect(() => {
    client.get('/audit-logs').then((r) => setLogs(r.data)).catch(() => setLogs([]))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Audit Logs</h1>
        <p className="text-sm text-slate-500">Immutable record of significant business actions (owner only)</p>
      </div>
      <div className="card">
        <DataTable
          columns={[
            { key: 'created_at', label: 'Timestamp', render: (l) => new Date(l.created_at).toLocaleString() },
            { key: 'user', label: 'User', render: (l) => l.user?.full_name || 'System' },
            { key: 'action', label: 'Action', render: (l) => <span className="font-medium">{l.action}</span> },
            { key: 'entity', label: 'Entity' },
            { key: 'entity_id', label: 'Record ID' },
            { key: 'detail', label: 'Details' },
            { key: 'ip_address', label: 'IP' },
          ]}
          rows={logs}
        />
      </div>
    </div>
  )
}