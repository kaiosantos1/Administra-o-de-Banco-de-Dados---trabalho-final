const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'tpc_h';

// Caminho onde estão os arquivos .tbl
const dataPath = '\\dbgen.data';

const tabelas = [
    {
        colecao: 'region', arquivo: path.join(dataPath, 'region.tbl'),
        mapear: (v) => ({
            r_regionkey: parseInt(v[0], 10),
            r_name: v[1],
            r_comment: v[2]
        })
    },
    {
        colecao: 'nation', arquivo: path.join(dataPath, 'nation.tbl'),
        mapear: (v) => ({
            n_nationkey: parseInt(v[0], 10),
            n_name: v[1],
            n_regionkey: parseInt(v[2], 10),
            n_comment: v[3]
        })
    },
    {
        colecao: 'part', arquivo: path.join(dataPath, 'part.tbl'),
        mapear: (v) => ({
            p_partkey: parseInt(v[0], 10),
            p_name: v[1],
            p_mfgr: v[2],
            p_brand: v[3],
            p_type: v[4],
            p_size: parseInt(v[5], 10),
            p_container: v[6],
            p_retailprice: parseFloat(v[7]),
            p_comment: v[8]
        })
    },
    {
        colecao: 'supplier', arquivo: path.join(dataPath, 'supplier.tbl'),
        mapear: (v) => ({
            s_suppkey: parseInt(v[0], 10),
            s_name: v[1],
            s_address: v[2],
            s_nationkey: parseInt(v[3], 10),
            s_phone: v[4],
            s_acctbal: parseFloat(v[5]),
            s_comment: v[6]
        })
    },
    {
        colecao: 'partsupp', arquivo: path.join(dataPath, 'partsupp.tbl'),
        mapear: (v) => ({
            ps_partkey: parseInt(v[0], 10),
            ps_suppkey: parseInt(v[1], 10),
            ps_availqty: parseInt(v[2], 10),
            ps_supplycost: parseFloat(v[3]),
            ps_comment: v[4]
        })
    },
    {
        colecao: 'customer', arquivo: path.join(dataPath, 'customer.tbl'),
        mapear: (v) => ({
            c_custkey: parseInt(v[0], 10),
            c_name: v[1],
            c_address: v[2],
            c_nationkey: parseInt(v[3], 10),
            c_phone: v[4],
            c_acctbal: parseFloat(v[5]),
            c_mktsegment: v[6],
            c_comment: v[7]
        })
    },
    {
        colecao: 'orders', arquivo: path.join(dataPath, 'orders.tbl'),
        mapear: (v) => ({
            o_orderkey: parseInt(v[0], 10),
            o_custkey: parseInt(v[1], 10),
            o_orderstatus: v[2],
            o_totalprice: parseFloat(v[3]),
            o_orderdate: new Date(v[4]),
            o_orderpriority: v[5],
            o_clerk: v[6],
            o_shippriority: parseInt(v[7], 10),
            o_comment: v[8]
        })
    },
    {
        colecao: 'lineitem', arquivo: path.join(dataPath, 'lineitem.tbl'),
        mapear: (v) => ({
            l_orderkey: parseInt(v[0], 10),
            l_partkey: parseInt(v[1], 10),
            l_suppkey: parseInt(v[2], 10),
            l_linenumber: parseInt(v[3], 10),
            l_quantity: parseFloat(v[4]),
            l_extendedprice: parseFloat(v[5]),
            l_discount: parseFloat(v[6]),
            l_tax: parseFloat(v[7]),
            l_returnflag: v[8],
            l_linestatus: v[9],
            l_shipdate: new Date(v[10]),
            l_commitdate: new Date(v[11]),
            l_receiptdate: new Date(v[12]),
            l_shipinstruct: v[13],
            l_shipmode: v[14],
            l_comment: v[15]
        })
    }
];

async function importarTabela(client, config) {
    // Pula se o arquivo não existir na pasta
    if (!fs.existsSync(config.arquivo)) {
        console.log(`Arquivo ${config.arquivo} não encontrado. Pulando...`);
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(config.colecao);
    
    await collection.deleteMany({});
    console.log(`\nIniciando importação de: ${config.colecao.toUpperCase()}`);

    const fileStream = fs.createReadStream(config.arquivo);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch = [];
    const batchSize = 10000;
    let totalInseridos = 0;

    for await (const line of rl) {
        const valores = line.split('|').slice(0, -1);
        batch.push(config.mapear(valores));

        if (batch.length >= batchSize) {
            await collection.insertMany(batch);
            totalInseridos += batch.length;
            process.stdout.write(`\r Inseridos: ${totalInseridos}`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await collection.insertMany(batch);
        totalInseridos += batch.length;
    }

    console.log(`\n${config.colecao.toUpperCase()} finalizada! Total: ${totalInseridos}`);
}

async function iniciarImportacao() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Conectado ao MongoDB. Iniciando processamento em lote...');
        
        for (const tabela of tabelas) {
            await importarTabela(client, tabela);
        }

        console.log('\nTODAS AS TABELAS FORAM IMPORTADAS COM SUCESSO!');
    } catch (erro) {
        console.error('Erro global:', erro);
    } finally {
        await client.close();
    }
}

iniciarImportacao();