import type { ReactNode } from "react";

type ColunaRodape = {
  title: ReactNode;
  key: string;
  items: { key: string; node: ReactNode }[];
};

export function SiteFooter({
  children,
  columns,
}: {
  children?: ReactNode;
  columns?: ColunaRodape[];
}) {
  return (
    <footer className="mt-12 bg-footer text-footer-foreground">
      <div className="sinaveg-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {columns?.map((coluna) => (
          <div key={coluna.key}>
            <p className="mb-3 text-xs font-semibold tracking-wide text-white/80 uppercase">
              {coluna.title}
            </p>
            <ul className="space-y-1.5 text-[0.8125rem]">
              {coluna.items.map((item) => (
                <li key={item.key}>{item.node}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {children !== undefined ? (
        <div className="border-t border-white/10">
          <div className="sinaveg-container flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-white/70">
            {children}
          </div>
        </div>
      ) : null}
    </footer>
  );
}
