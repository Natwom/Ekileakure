import { Receipt, Smartphone, ShieldCheck, Check } from 'lucide-react'
import Badge from '../components/Badge'

const rules = [
  'M-Pesa transaction principal is never recorded as agency revenue.',
  'Completed transactions cannot be deleted. Corrections use reversal records.',
  'Float and physical cash keep independent ledgers.',
  "Verified closing balances carry forward as the next day's openings.",
  'All money values use exact decimal storage, never floating point.',
]

function Section({ icon: Icon, title, desc, children }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100">
        <span className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-semibold text-navy">{title}</h2>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function Settings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Receipt details, integrations and accounting rules</p>
      </div>

      <Section icon={Receipt} title="Receipts" desc="What customers see at the top and bottom of a receipt.">
        <div className="space-y-4">
          <div>
            <label htmlFor="biz" className="text-xs font-medium text-slate-500">Business name</label>
            <input id="biz" className="input mt-1" defaultValue="EkileAkure" />
          </div>
          <div>
            <label htmlFor="foot" className="text-xs font-medium text-slate-500">Footer message</label>
            <input id="foot" className="input mt-1" defaultValue="Thank you for your business!" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="button" disabled className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              Save settings
            </button>
            <span className="text-xs text-slate-400">Saving is not connected to the server yet.</span>
          </div>
        </div>
      </Section>

      <Section icon={Smartphone} title="M-Pesa integration"
        desc="Transactions are recorded by hand for now.">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge tone="slate">Not configured</Badge>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          The ledgers are built so an authorised Safaricom integration can be added later. Customer PINs and
          OTPs must never be stored. Not every M-Pesa API exposes agent deposit and withdrawal operations, so
          an integration would only cover what Safaricom supports.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="Accounting rules" desc="How the system keeps your books honest.">
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={12} />
              </span>
              {r}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}