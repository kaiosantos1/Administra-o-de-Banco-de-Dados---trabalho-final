# PostgreSQL — Benchmark TPC-H

Esta pasta contém todos os arquivos necessários para rodar o benchmark TPC-H no PostgreSQL.

---

## Estrutura da pasta

```
postgres/
├── criar_banco.sql      # Cria o schema, as tabelas e importa os dados do TPC-H
├── consultas_tpch.cjs   # Script principal: executa as queries e mede o tempo de cada uma
└── queries/
    ├── 1.sql            # Query 1 do benchmark TPC-H
    ├── 2.sql            # Query 2 do benchmark TPC-H
    ├── ...
    └── 22.sql           # Query 22 do benchmark TPC-H
```

---

## Pré-requisitos

Antes de rodar, você precisa ter instalado:

- **PostgreSQL** — o banco de dados relacional utilizado no benchmark
  - Download: https://www.postgresql.org/
  - Durante a instalação, anote a senha que você definir para o usuário `postgres`
- **Node.js** — ambiente de execução do script
  - Download: https://nodejs.org/
  - Versão recomendada: 18 ou superior
  - Para verificar se já está instalado, rode no prompt: `node --version`

---

## Configuração do banco de dados

Antes de rodar o script, o banco precisa estar criado e populado com os dados do TPC-H.

### 1. Criar o banco

No pgAdmin 4, clique com o botão direito em **Databases → Create → Database**, crie um banco chamado `tpch` e salve.

### 2. Executar o script de criação

Abra o arquivo `criar_banco.sql` em um editor de texto e substitua todas as ocorrências de:
```
C:\caminho\para\dbgen.data\
```
pelo caminho real da pasta `dbgen.data` no seu computador. Exemplo:
```
D:\Faculdade\2026.1\BD2\Benchmark TPC-H\dbgen.data\
```

Depois, no pgAdmin 4, abra o banco `tpch`, abra o **Query Tool**, abra o arquivo `criar_banco.sql` e execute. O script cria o schema, todas as tabelas, importa os dados e adiciona as chaves estrangeiras automaticamente.

> A importação do `lineitem.tbl` pode demorar alguns minutos pois é o maior arquivo.

### 3. Verificar a importação

Após executar, confirme que os dados foram importados corretamente rodando no Query Tool:

```sql
SET search_path TO "tpc-h";
SELECT 'part', COUNT(*) FROM part
UNION ALL SELECT 'supplier', COUNT(*) FROM supplier
UNION ALL SELECT 'partsupp', COUNT(*) FROM partsupp
UNION ALL SELECT 'customer', COUNT(*) FROM customer
UNION ALL SELECT 'orders',   COUNT(*) FROM orders
UNION ALL SELECT 'lineitem', COUNT(*) FROM lineitem
UNION ALL SELECT 'nation',   COUNT(*) FROM nation
UNION ALL SELECT 'region',   COUNT(*) FROM region;
```

Os valores esperados são:
- part: 20.000
- supplier: 1.000
- partsupp: 80.000
- customer: 15.000
- orders: 150.000
- lineitem: 600.572
- nation: 25
- region: 5

---

## Configuração do script

Abra o arquivo `consultas_tpch.cjs` e localize o bloco de configuração no início:

```javascript
const DB_CONFIG = {
    host:     'localhost',
    port:     5432,
    database: 'tpch',       // nome do banco que você criou
    user:     'postgres',   // seu usuário do PostgreSQL
    password: '',           // coloque aqui a sua senha do PostgreSQL
};
```

Preencha o campo `password` com a senha definida durante a instalação do PostgreSQL.

---

## Instalação das dependências

Na pasta `postgres`, rode no prompt de comando:

```
npm install pg
```

Isso instala a biblioteca `pg`, que é o driver de conexão com o PostgreSQL para Node.js.

---

## Como rodar o benchmark

Com o banco configurado e a dependência instalada, use os comandos abaixo no prompt dentro da pasta `postgres`:

```
# Rodar apenas uma query (exemplo: Query 1)
node consultas_tpch.cjs 1

# Rodar várias queries específicas (exemplo: Queries 1, 5 e 13)
node consultas_tpch.cjs 1 5 13

# Rodar todas as 22 queries em sequência
node consultas_tpch.cjs all
```

O script exibe o tempo de execução de cada query e uma amostra de até 10 linhas do resultado.

---

## Objetivo

Implementar as 22 consultas do benchmark TPC-H no PostgreSQL, medir o tempo de execução de cada uma e comparar o desempenho com a implementação equivalente no MongoDB.