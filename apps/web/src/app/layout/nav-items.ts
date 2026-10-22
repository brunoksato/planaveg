import { BarChart3, Database, Map, type LucideIcon } from "lucide-react";

type ItemNavegacao = {
  to: "/" | "/mapa" | "/painel" | "/dados";
  label: string;
  icon: LucideIcon;
};

export const NAVEGACAO_PORTAL: readonly ItemNavegacao[] = [
  { to: "/", label: "Visão geral", icon: Database },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/painel", label: "Painel", icon: BarChart3 },
  { to: "/dados", label: "Acesso aos dados", icon: Database },
];
