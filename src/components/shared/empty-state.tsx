import { Button } from "@/src/components/ui/button";

export function EmptyState({ title, subtitle, cta }: { title: string; subtitle: string; cta?: { label: string; href: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgb(var(--theme-accent-rgb)/0.25)] bg-white p-10 text-center">
      <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
      {cta ? (
        <a href={cta.href} className="mt-4 inline-block">
          <Button>{cta.label}</Button>
        </a>
      ) : null}
    </div>
  );
}
