/** As tabelas de números para baixar, com o nome e o que cada linha traz. */
export const TABELAS_PARA_BAIXAR = [
  {
    tabela: "quantitativo_categoria",
    nome: "Área por categoria",
    descricao:
      "Uma linha por ano, categoria e situação do cadastro no CAR, como na planilha de nomenclatura.",
  },
  {
    tabela: "quantitativo_arranjo",
    nome: "Área por arranjo de implementação",
    descricao: "Uma linha por ano e arranjo.",
  },
  {
    tabela: "quantitativo_filtro",
    nome: "Área por tema do relatório",
    descricao: "Uma linha por ano e tema; os temas se sobrepõem.",
  },
  {
    tabela: "quantitativo_dimensao",
    nome: "Área por lugar",
    descricao: "Estados, municípios, bacias, regiões hidrográficas e biomas, por ano.",
  },
] as const;
