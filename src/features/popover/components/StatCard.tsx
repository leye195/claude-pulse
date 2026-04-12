export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-lg px-3 py-2">
      <div className="text-[10px] text-(--text-secondary)">{label}</div>
      <div className="text-base font-semibold text-(--text-primary)">{value}</div>
    </div>
  );
}
