/**
 * As três partes de Acesso aos dados, como no TerraBrasilis (revisão da MMA de 16/10/2026): os
 * downloads, os metadados (o que os dados são e como os números são calculados) e os serviços
 * web. Sem `?secao`, a página mostra as três como cartões. Sem os ícones, que ficam nos cartões
 * (`PartesDoAcesso`): o schema da rota importa esta lista, e ela vai para o bundle principal.
 */
export const SECOES = [
  {
    id: "downloads",
    rotulo: "Downloads",
    resumo: "Arquivos vetoriais e tabelas disponíveis para baixar.",
  },
  {
    id: "metadados",
    rotulo: "Metadados",
    resumo:
      "Descrição das características dos dados disponíveis e de como os números são calculados.",
  },
  {
    id: "servicos",
    rotulo: "Serviços Web",
    resumo: "Acesso, documentação e especificação dos serviços web disponíveis.",
  },
] as const satisfies ReadonlyArray<{ id: string; rotulo: string; resumo: string }>;

export type SecaoDados = (typeof SECOES)[number]["id"];
