export default function DataTable({ columns, rows, empty = 'No records found' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{columns.map((c) => <th key={c.key} className="th">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="td text-center text-slate-400 py-10">{empty}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className="td">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}