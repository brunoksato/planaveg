/**
 * O que a tabela dos arranjos de implementação do Planaveg diz de cada um: os critérios de
 * elegibilidade e o atributo espacial. O nome é o do glossário (o da revisão do MMA, o mesmo em
 * todo o portal); a meta e a cor vêm do catálogo.
 */
type LegendaDoArranjo = {
  elegibilidade: readonly string[];
  atributo: readonly string[];
  /** Onde a base ainda conta diferente da tabela. */
  nota?: string;
};

const TODOS_OS_CRITERIOS = [
  "Projetos de Recuperação da Vegetação Nativa (todos os subitens)",
  "Vegetação Secundária em Áreas Legalmente Protegidas (todos os subitens)",
];

const LEGENDAS: Readonly<Record<string, LegendaDoArranjo>> = {
  areas_publicas: {
    elegibilidade: TODOS_OS_CRITERIOS,
    atributo: [
      "Terras Indígenas",
      "Unidades de Conservação (nas APAs, só as áreas públicas) e RPPNs",
      "Manguezais",
      "Assentamentos rurais e territórios quilombolas",
    ],
  },
  app_rl_aur: {
    elegibilidade: TODOS_OS_CRITERIOS,
    atributo: ["Cadastro Ambiental Rural (APP; RL; AUR)", "PRADA dos imóveis em regularização"],
  },
  baixa_produtividade: {
    elegibilidade: [
      "Projetos de Recuperação da Vegetação: outras áreas de projetos não incluídas nas categorias Embargo, LAC e Reparação por Danos",
      "Nos dados do Observatório da Restauração (OR): técnicas de restauração com fins econômicos ou restauração produtiva (SAF, ILPF, silvicultura de nativas)",
    ],
    atributo: [
      "Não incluídas nas áreas públicas (UCs e TIs), nem nas áreas do CAR (APP, RL e AUR)",
    ],
  },
};

/**
 * A legenda de um arranjo; um arranjo novo no catálogo fica sem critérios. Um arranjo ausente
 * leva, como nota, o motivo que o catálogo dá.
 */
export function legendaDoArranjo(codigo: string, motivoAusencia: string | null): LegendaDoArranjo {
  const legenda = LEGENDAS[codigo] ?? { elegibilidade: [], atributo: [] };
  return motivoAusencia === null ? legenda : { ...legenda, nota: motivoAusencia };
}
