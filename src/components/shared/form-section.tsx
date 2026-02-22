export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-7">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
        {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
