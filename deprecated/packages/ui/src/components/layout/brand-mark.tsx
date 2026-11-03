import type { ReactNode } from "react";

/** A marca do portal no cabeçalho: o logo, o nome e, na tela larga, o subtítulo. */
export function BrandMark({
  title,
  subtitle,
  logo,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  logo?: ReactNode;
}) {
  return (
    <>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-header-foreground [&_svg]:size-[18px]">
        {logo}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[0.9375rem] font-semibold">{title}</p>
        {subtitle !== undefined ? (
          // Um nome longo (o oficial do sistema) quebra em até duas linhas, sem empurrar o resto
          // da faixa: quem chama limita a largura da marca.
          <p className="hidden text-xs text-header-muted xl:line-clamp-2">{subtitle}</p>
        ) : null}
      </div>
    </>
  );
}
