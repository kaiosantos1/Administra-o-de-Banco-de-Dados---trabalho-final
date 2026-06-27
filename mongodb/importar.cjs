const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'tpc_h';

// colocar abaixo caminho da pasta com os arquivos .tbl
const dataPath = '\\dbgen.data';

const tabelasSimples = [
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
    }
];

async function importarPedidosEAninharItens(client) {
    const db = client.db(dbName);
    const ordersCol = db.collection('orders');

    await ordersCol.deleteMany({});

    console.log('\nFASE 1: Importando ORDERS...');
    let arquivoOrders = path.join(dataPath, 'orders.tbl');
    if (!fs.existsSync(arquivoOrders)) {
        console.log(`Arquivo ${arquivoOrders} não encontrado. Pulando...`);
        return;
    }

    let fileStream = fs.createReadStream(arquivoOrders);
    let rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batchOrders = [];
    let totalOrders = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;

        const v = line.split('|').slice(0, -1);
        batchOrders.push({
            _id: parseInt(v[0], 10),
            o_orderkey: parseInt(v[0], 10),
            o_custkey: parseInt(v[1], 10),
            o_orderstatus: v[2],
            o_totalprice: parseFloat(v[3]),
            o_orderdate: new Date(v[4]),
            o_orderpriority: v[5],
            o_clerk: v[6],
            o_shippriority: parseInt(v[7], 10),
            o_comment: v[8],
            lineitems: []
        });

        if (batchOrders.length >= 10000) {
            await ordersCol.insertMany(batchOrders);
            totalOrders += batchOrders.length;
            process.stdout.write(`\rPedidos inseridos: ${totalOrders}`);
            batchOrders = [];
        }
    }
    if (batchOrders.length > 0) {
        await ordersCol.insertMany(batchOrders);
        totalOrders += batchOrders.length;
    }
    console.log(`\nFASE 1 Concluída! Total de Pedidos: ${totalOrders}`);

    console.log('\nFASE 2: Aninhando LINEITEMS dentro dos Pedidos...');
    let arquivoLineitem = path.join(dataPath, 'lineitem.tbl');
    if (!fs.existsSync(arquivoLineitem)) {
        console.log(`Arquivo ${arquivoLineitem} não encontrado. Pulando Fase 2...`);
    } else {
        fileStream = fs.createReadStream(arquivoLineitem);
        rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let bulkOps = [];
        let totalItems = 0;

        for await (const line of rl) {
            if (!line.trim()) continue;

            const v = line.split('|').slice(0, -1);
            const l_orderkey = parseInt(v[0], 10);
            
            const item = {
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
            };

            bulkOps.push({
                updateOne: {
                    filter: { _id: l_orderkey },
                    update: { $push: { lineitems: item } }
                }
            });

            if (bulkOps.length >= 5000) {
                await ordersCol.bulkWrite(bulkOps);
                totalItems += bulkOps.length;
                process.stdout.write(`\rItens aninhados: ${totalItems}`);
                bulkOps = [];
            }
        }
        
        if (bulkOps.length > 0) {
            await ordersCol.bulkWrite(bulkOps);
            totalItems += bulkOps.length;
        }
        console.log(`\nFASE 2 Concluída! Total de Itens aninhados: ${totalItems}`);
    }

    console.log('\nFASE 3: Criando Índices Multikey...');
    await ordersCol.createIndex({ "lineitems.l_shipdate": 1 });
    await ordersCol.createIndex({ "lineitems.l_returnflag": 1, "lineitems.l_linestatus": 1 });
    await ordersCol.createIndex({ "o_orderdate": 1 });
    console.log('Índices de Orders criados com sucesso!');
}

async function importarTabelaSimples(client, config) {
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
    let totalInseridos = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;

        const valores = line.split('|').slice(0, -1);
        batch.push(config.mapear(valores));

        if (batch.length >= 10000) {
            await collection.insertMany(batch);
            totalInseridos += batch.length;
            process.stdout.write(`\rInseridos: ${totalInseridos}`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await collection.insertMany(batch);
        totalInseridos += batch.length;
    }

    console.log(`\n${config.colecao.toUpperCase()} finalizada! Total: ${totalInseridos}`);
    
    const pkField = Object.keys(config.mapear(["0","","","","","","","","","",""])).find(k => k.includes('key'));
    if(pkField) {
        await collection.createIndex({ [pkField]: 1 });
        console.log(`   Índice criado para ${pkField}`);
    }
}

async function iniciarImportacao() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Ligado ao MongoDB. Importando TPC-H...');
        
        await importarPedidosEAninharItens(client);

        for (const tabela of tabelasSimples) {
            await importarTabelaSimples(client, tabela);
        }

        console.log('\nSUCESSO! TODAS AS COLEÇÕES ESTÃO PRONTAS E OTIMIZADAS NO MONGODB!');
    } catch (erro) {
        console.error('Erro global:', erro);
    } finally {
        await client.close();
    }
}

iniciarImportacao();