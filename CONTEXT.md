# Linguagem do domínio do SINAVEG

O SINAVEG (Sistema Nacional de Monitoramento Geoespacial e Reporte de Áreas em Processo de
Recuperação da Vegetação Nativa) mostra ao público a recuperação da vegetação nativa que o Planaveg
contabiliza, a partir da base final entregue em GeoPackage. Quando o portal usa um nome mais simples para um termo, ele
aparece em _No portal_.

## A base

**Base Planaveg**
O GeoPackage final (`Planaveg_2026_Categorias_Visualizacao.gpkg`). Ele já é o resultado da
metodologia: cada peça vem classificada. O sistema carrega, confere e publica, sem recalcular.

**Entrega**
O arquivo carregado. Fica registrado na tabela `entrega` pelo SHA-256 do conteúdo e pela versão do
contrato, e recarregar o mesmo arquivo com o mesmo contrato reaproveita a linha. Carregar outra
entrega substitui a anterior numa transação só. O banco guarda as peças de uma entrega só, mas
guarda para sempre as entregas, as versões do contrato e os números de cada publicação.

**Publicação**
Uma publicação no GeoServer que mudou os dados (a versão dos dados). Fica em `publicacao`, com a
entrega, a versão do contrato e os números que pôs no ar: o cômputo por nível, a série e as
facetas.

**Contrato**
O `categorias.v1.json`. Diz como o arquivo tem de ser (camadas, colunas, tipos, CRS) e guarda as
regras: hierarquia, marcas, arranjos, filtros, dimensões, cores e fontes ausentes. É o único lugar
com essas regras. Diante de algo que não conhece, ele falha em vez de seguir. Cada versão dele fica
guardada no banco, identificada pelo SHA-256 do JSON.

**Vegetação Secundária (VS)**
Vegetação nativa que voltou a crescer numa área que já foi desmatada.

**Ano de VS**
O ano do mapeamento da vegetação secundária (VS 2022, VS 2024). Cada ano é uma camada do arquivo e
um retrato, e os anos não se somam. O mapa e o painel mostram só o mais recente, sem dizer o ano; os
outros ficam nos downloads e nos serviços web.

**Peça**
Um registro de um ano, de vegetação secundária ou de área de projeto de recuperação, já recortado
pela hierarquia, por município, por bacia, por bioma e por UF. É um multipolígono que junta todos
os polígonos com os mesmos atributos (nível, situação do CAR, marcas) no mesmo município, bacia,
bioma e UF. A área da peça, em hectares, é a soma deles. Em 2024 são 70.739 peças e 4,75 milhões de polígonos, com até 16.591 numa
peça só. _No portal_: "área" ou "área mapeada".

**Polígono**
Cada parte de uma peça (`peca_parte`). É o que o mapa desenha separado e o que o clique mostra, com
a área dele. As áreas dos polígonos de uma peça somam a área da peça. _No portal_: "polígono".

**Marca**
Um atributo da peça que diz sobre o que ela está: APP, RL, AUR, imóvel do CAR, Terra Indígena,
Unidade de Conservação, embargo e outros. Uma peça pode ter várias. A coluna `Sobreposicao` junta
as marcas fundiárias num texto só.

## Cômputo e classificação

**Cômputo Planaveg**
A área que o Planaveg conta como em recuperação (seção 4 do relatório). Entram duas coisas:

- a vegetação secundária em área protegida por lei: TI, UC, manguezal, APP, AUR e RL do CAR
- as áreas de projetos de recuperação, inteiras, mesmo sem vegetação detectada. Por isso as do
  Recooperar e as do CAR em regularização não mudam de um ano para o outro.

O total de cada nível vem no arquivo, e o sistema confere esse total contra a soma das peças. _No
portal_: "área em recuperação".

**Nível**
Uma linha da hierarquia do Anexo 1 do relatório, identificada pelo tier (de 1, Recooperar, a 11,
Reserva Legal). Os níveis são aplicados em ordem de precedência, e cada peça entra em um nível só.
_No portal_: "categoria", com os nomes da planilha de nomenclatura do SINAVEG: Recooperar,
MonitoRAD, PRADA, Projetos de Cooperação MMA, Observatório da Restauração e Recuperação, Terras
Indígenas, Unidades de Conservação, Sistemas Costeiros (os manguezais), Área de Preservação
Permanente, Área de Uso Restrito e Reserva Legal.

**Grupo**
Um conjunto de níveis. São dois, as categorias de saída do relatório (seção 4), com os nomes da
planilha de nomenclatura: Projetos de Recuperação da Vegetação Nativa e Vegetação Secundária em
Áreas Legalmente Protegidas. O segundo inclui as APP, AUR e RL do CAR, porque elas também são
protegidas por lei.

**Critério**
O nome dos dois grupos no código do portal, como na tabela de critérios do Planaveg:
`intencionalidade` (os projetos) e `governanca` (a vegetação secundária protegida). O portal não
mostra esses nomes, e sim os dos grupos.

**Condição do CAR**
A situação do cadastro do imóvel nos níveis de APP, AUR e RL. A base traz três situações
(`Habilitados`, `Analisados` e `Nao_Analisados`), e o portal as junta nas duas condições da
planilha: analisado, em conformidade com a Lei nº 12.651/2012, com ativos e em regularização
(`Habilitados`); e não analisado, em análise ou aguardando retificação (as outras duas). O
contrato diz a de cada condição da base (`situacao`), e as saídas publicadas a trazem com esse
nome (`situacao_cadastro`). O termo "habilitado" não aparece no portal nem nos downloads; só as
colunas cruas do WFS (`categoria`, `hierarquia` e as marcas do CAR) guardam os nomes da base. _No
portal_: "situação do cadastro".

**Arranjo de Implementação**
Um dos três arranjos do Anexo 2, em ordem de prioridade, com os nomes da revisão do MMA:
recuperação da vegetação nativa em áreas públicas (TI, UC, RPPN, manguezais, assentamentos e
quilombolas); em APP, RL e AUR; e recuperação da vegetação em áreas rurais consolidadas com
sistemas integrados de produção. Este último fica zerado por enquanto, porque a base não traz as
técnicas de restauração com fins econômicos que o definem. O que não entra em nenhum fica nas
demais áreas de projetos, que não têm meta própria: no portal elas não têm caixa nem lugar no
filtro, só uma nota, e entram no total. Os quatro dividem o cômputo sem sobreposição. _No portal_:
"arranjo de implementação".

**Filtro do Relatório**
Um recorte temático do relatório, definido por marcas: embargos, reparação de danos,
licenciamento, UC, TI, assentamentos, territórios quilombolas, manguezais e outros. Pode ser
espacial (tem camada no mapa), quantitativo ou os dois. Na base, pode estar completo, parcial ou
vazio. _No portal_: "tema".

**Dimensão**
Um recorte territorial dos números: UF, município, bioma e as bacias em três níveis, do maior ao
menor: região hidrográfica, mesobacia e bacia. _No portal_: "lugar".

**Regra de Não Dupla Contagem**
Níveis e arranjos dividem o cômputo e podem ser somados. Filtros se sobrepõem e nunca são somados
para formar um total.

**Fonte Ausente**
O que o relatório pede e a base não traz: MonitoRAD, áreas prioritárias, malhas territoriais e
outros. Aparece como ausente e nunca é preenchida por dedução.

## Publicação

**View Publicada**
Uma camada de mapa ou tabela que o GeoServer serve a partir do PostGIS: peças por ano, temas por
ano, municípios, números, série e catálogos. É o contrato com o portal.

**Versão do Mapa**
Um resumo da entrega, do SQL das views desenhadas e do que elas leem, com as regras do contrato, e
dos estilos. Vai na URL dos tiles. Quando muda, o cache da camada é esvaziado.

**Semeadura**
Gerar antes, no cache do GeoServer, os tiles das escalas que custam mais para desenhar.

**Nome Simples e Nome Oficial**
O portal mostra o nome simples de cada termo e deixa o nome oficial do relatório à vista, na dica
e nas tabelas.

**Estimativa Técnica**
O resultado que a equipe publica a partir da base vigente. Dá para reproduzir e conferir, mas
sozinho não vale como resultado oficial.

**Resultado Oficial Planaveg**
O resultado que entrou num relatório aprovado pelo Plenário da Conaveg e publicado pelo MMA, ou que
foi reconhecido formalmente por um ato equivalente. O sistema não transforma uma Estimativa Técnica
em resultado oficial.
