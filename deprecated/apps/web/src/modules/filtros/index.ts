/*
 * O módulo dos filtros das áreas, comum ao mapa e ao painel: as listas da lateral, as facetas
 * somadas no navegador, o CQL dos filtros e os filtros na URL.
 */
export { FiltrosDoMapa } from "./components/FiltrosDoMapa";
export { FiltrosDoPainel } from "./components/FiltrosDoPainel";
export { ResumoDasAreas } from "./components/ResumoDasAreas";
export { useFacetas } from "./services/facetas.queries";
export { descreverFiltros } from "./utils/descricao";
export { cqlDosFiltros } from "./utils/cql";
export {
  MAIS_DE_UMA,
  PROCESSOS,
  prepararFacetas,
  resumir,
  SEM_ESFERA,
  totaisDasListas,
  totaisPorValor,
  totalFiltrado,
  type LinhaFaceta,
  type Processo,
  type Resumo,
  type Total,
} from "./utils/facetas";
export {
  DIMENSOES_DO_PAINEL,
  DIMENSOES_FILTRO,
  NENHUM_TIPO,
  SEM_FILTROS,
  temFiltros,
  type DimensaoFiltro,
  type FiltrosAreas,
} from "./utils/filtros";
export { filtrosNaUrl } from "./utils/filtros-na-url";
export { tiposDeArea } from "./utils/opcoes";
export {
  alternarNaUrl,
  alternarTipoDeArea,
  filtrosDoEstado,
  filtrosParaUrl,
  limparNaUrl,
  tiposParaOMapa,
  tiposParaOPainel,
} from "./utils/url";
