import { Button } from "@/src/components/ui/button";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; onClick?: () => void } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}
