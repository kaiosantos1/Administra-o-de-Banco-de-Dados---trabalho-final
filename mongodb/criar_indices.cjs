const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'tpc_h';

async function criarIndices() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);
        console.log('Ligado ao MongoDB. Iniciando a criação de índices de otimização...\n');

        // ÍNDICES PARA A COLEÇÃO ORDERS
        console.log('Indexando ORDERS e LINEITEMS (Subdocumentos)...');
        const ordersCol = db.collection('orders');
        await ordersCol.createIndex({ o_orderdate: 1 });
        await ordersCol.createIndex({ o_custkey: 1 });


        await ordersCol.createIndex({ o_custkey: 1, o_comment: 1 });  // solução para a Q13
        
        // índices que entram nos arrays de itens
        await ordersCol.createIndex({ "lineitems.l_shipdate": 1 });
        await ordersCol.createIndex({ "lineitems.l_receiptdate": 1 });
        await ordersCol.createIndex({ "lineitems.l_commitdate": 1 });
        await ordersCol.createIndex({ "lineitems.l_partkey": 1 });
        await ordersCol.createIndex({ "lineitems.l_suppkey": 1 });
        await ordersCol.createIndex({ "lineitems.l_returnflag": 1, "lineitems.l_linestatus": 1 });
        await ordersCol.createIndex({ "lineitems.l_shipmode": 1 });

        // ÍNDICES PARA CUSTOMER
        console.log('Indexando CUSTOMER...');
        const customerCol = db.collection('customer');
        await customerCol.createIndex({ c_mktsegment: 1 });
        await customerCol.createIndex({ c_nationkey: 1 });
        await customerCol.createIndex({ c_phone: 1 });

        // ÍNDICES PARA PART e PARTSUPP
        console.log('Indexando PART e PARTSUPP...');
        const partCol = db.collection('part');
        await partCol.createIndex({ p_size: 1 });
        await partCol.createIndex({ p_type: 1 });
        await partCol.createIndex({ p_brand: 1 });
        await partCol.createIndex({ p_name: 1 });

        const partsuppCol = db.collection('partsupp');
        await partsuppCol.createIndex({ ps_partkey: 1, ps_suppkey: 1 });
        await partsuppCol.createIndex({ ps_suppkey: 1 });

        // ÍNDICES PARA SUPPLIER, NATION e REGION
        console.log('Indexando SUPPLIER, NATION e REGION...');
        const supplierCol = db.collection('supplier');
        await supplierCol.createIndex({ s_nationkey: 1 });

        const nationCol = db.collection('nation');
        await nationCol.createIndex({ n_name: 1 });
        await nationCol.createIndex({ n_regionkey: 1 });

        const regionCol = db.collection('region');
        await regionCol.createIndex({ r_name: 1 });

        console.log('\nTODOS OS ÍNDICES FORAM CRIADOS COM SUCESSO!');
        console.log('A base de dados NoSQL está agora otimizada para o benchmark.');

    } catch (erro) {
        console.error('Erro ao criar índices:', erro);
    } finally {
        await client.close();
    }
}

criarIndices();