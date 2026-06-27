# MongoDB

Esta pasta contém os arquivos relacionados à implementação do benchmark TPC-H no MongoDB.

## Para rodar (na ordem):

1. `importar.cjs` -> script de importação dos dados -> colocar no 'dataPath' o caminho da pasta dbgen.data (que tem que ter todos arquivos .tbl) e rode no prompt com `node importar.cjs`
2. `criar_indices.cjs` -> para criar os índices no mongodb -> rode no prompt com `node criar_indices.csj`
3. `consultas_tpch.cjs` -> para rodar as consultas e benchmark -> use o comando `node consultas_tpch.cjs x` substituindo x pela query desejada

## Objetivo

Implementar consultas equivalentes às do benchmark TPC-H utilizando o modelo orientado a documentos e comparar seu desempenho com o PostgreSQL.