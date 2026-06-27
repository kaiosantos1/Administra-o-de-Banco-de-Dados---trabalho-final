# MongoDB

Esta pasta contém os arquivos relacionados à implementação do benchmark TPC-H no MongoDB.

## Conteúdo esperado

- 'importar.cjs' -> script de importação dos dados -> colocar no 'dataPath' o caminho da pasta dbgen.data (que tem que ter todos arquivos .tbl) e rode no prompt com 'node importar.cjs'
- Modelagem das coleções
- Pipelines de agregação
- Índices criados
- Configurações utilizadas nos testes
- Evidências e resultados obtidos

## Objetivo

Implementar consultas equivalentes às do benchmark TPC-H utilizando o modelo orientado a documentos e comparar seu desempenho com o PostgreSQL.