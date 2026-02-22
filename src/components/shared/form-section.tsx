export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
