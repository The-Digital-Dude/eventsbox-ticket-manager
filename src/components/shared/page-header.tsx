import { Button } from "@/src/components/ui/button";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; onClick?: () => void } }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--theme-accent-rgb)/0.72)]">
          Workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}
