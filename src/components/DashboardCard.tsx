export function DashboardCard({ label, value }: { label: string; value: string }) {
  return <div className="card"><div className="muted">{label}</div><div className="metric">{value}</div></div>
}
