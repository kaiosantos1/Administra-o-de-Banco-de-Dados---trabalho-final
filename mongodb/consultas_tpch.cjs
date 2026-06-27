const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'tpc_h';

// PAINEL DE CONTROLE DO BENCHMARK
const args = process.argv.slice(2);
let QUERIES_A_EXECUTAR = [];

if (args.length === 0) {
    console.log("ATENÇÃO: Indique qual query deseja executar.");
    console.log("Exemplo 1 (uma query): node consultas_tpch.cjs 10");
    console.log("Exemplo 2 (várias queries): node consultas_tpch.cjs 1 3 13");
    console.log("Exemplo 3 (todas as queries): node consultas_tpch.cjs all\n");
    process.exit(0);
}

if (args[0].toLowerCase() === 'all') {
    QUERIES_A_EXECUTAR = Array.from({length: 22}, (_, i) => i + 1);
} else {
    QUERIES_A_EXECUTAR = args.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 22);
    if (QUERIES_A_EXECUTAR.length === 0) {
        console.log("Argumentos inválidos. Use números de 1 a 22 ou a palavra 'all'.");
        process.exit(1);
    }
}

// se for 'true', desenha uma tabela no terminal com os resultados (amostra de 10 linhas)
const MOSTRAR_RESULTADOS = true; 

async function rodarConsultas() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const ordersCol = db.collection('orders');
        const customerCol = db.collection('customer');
        const partCol = db.collection('part');
        const partsuppCol = db.collection('partsupp');
        const supplierCol = db.collection('supplier');

        console.log('INICIANDO BENCHMARK TPC-H NO MONGODB\n');
        
        // todas as 22 Queries
        const queries = {
            1: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipdate": { $lte: new Date('1998-12-01') } } },
                    { 
                        $group: {
                            _id: { returnflag: "$lineitems.l_returnflag", linestatus: "$lineitems.l_linestatus" },
                            sum_qty: { $sum: "$lineitems.l_quantity" },
                            sum_base_price: { $sum: "$lineitems.l_extendedprice" },
                            sum_disc_price: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } },
                            sum_charge: { $sum: { $multiply: [{ $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] }, { $add: [1, "$lineitems.l_tax"] }] } },
                            avg_qty: { $avg: "$lineitems.l_quantity" },
                            avg_price: { $avg: "$lineitems.l_extendedprice" },
                            avg_disc: { $avg: "$lineitems.l_discount" },
                            count_order: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.returnflag": 1, "_id.linestatus": 1 } }
                ]).toArray();
            },
            2: async () => {
                return await partCol.aggregate([
                    { $match: { p_size: 15, p_type: { $regex: /PLATED/ } } },
                    { $lookup: { from: "partsupp", localField: "p_partkey", foreignField: "ps_partkey", as: "ps" } },
                    { $unwind: "$ps" },
                    { $lookup: { from: "supplier", localField: "ps.ps_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $lookup: { from: "region", localField: "n.n_regionkey", foreignField: "r_regionkey", as: "r" } },
                    { $unwind: "$r" },
                    { $match: { "r.r_name": "AMERICA" } },
                    { $sort: { "ps.ps_supplycost": 1 } },
                    { $limit: 100 }
                ]).toArray();
            },
            3: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderdate: { $lt: new Date('1995-03-15') } } },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $match: { "c.c_mktsegment": "BUILDING" } },
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipdate": { $gt: new Date('1995-03-15') } } },
                    {
                        $group: {
                            _id: { l_orderkey: "$_id", o_orderdate: "$o_orderdate", o_shippriority: "$o_shippriority" },
                            revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } }
                        }
                    },
                    { $sort: { revenue: -1, "_id.o_orderdate": 1 } },
                    { $limit: 10 }
                ]).toArray();
            },
            4: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderdate: { $gte: new Date('1995-03-15'), $lt: new Date('1995-06-15') } } },
                    { $match: { 
                        $expr: {
                            $gt: [
                                { $size: { $filter: { input: "$lineitems", as: "item", cond: { $lt: ["$$item.l_commitdate", "$$item.l_receiptdate"] } } } },
                                0
                            ]
                        }
                    }},
                    { $group: { _id: "$o_orderpriority", order_count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ]).toArray();
            },
            5: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderdate: { $gte: new Date('1994-01-01'), $lt: new Date('1995-01-01') } } },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $unwind: "$lineitems" },
                    { $lookup: { from: "supplier", localField: "lineitems.l_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $match: { $expr: { $eq: ["$c.c_nationkey", "$s.s_nationkey"] } } },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $lookup: { from: "region", localField: "n.n_regionkey", foreignField: "r_regionkey", as: "r" } },
                    { $unwind: "$r" },
                    { $match: { "r.r_name": "AMERICA" } },
                    { $group: { _id: "$n.n_name", revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } } } },
                    { $sort: { revenue: -1 } }
                ]).toArray();
            },
            6: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    {
                        $match: {
                            "lineitems.l_shipdate": { $gte: new Date('1994-01-01'), $lt: new Date('1995-01-01') },
                            "lineitems.l_discount": { $gte: 0.05, $lte: 0.07 },
                            "lineitems.l_quantity": { $lt: 24 }
                        }
                    },
                    { $group: { _id: null, revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", "$lineitems.l_discount"] } } } }
                ]).toArray();
            },
            7: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipdate": { $gte: new Date('1995-01-01'), $lte: new Date('1996-12-31') } } },
                    { $lookup: { from: "supplier", localField: "lineitems.l_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n1" } },
                    { $unwind: "$n1" },
                    { $lookup: { from: "nation", localField: "c.c_nationkey", foreignField: "n_nationkey", as: "n2" } },
                    { $unwind: "$n2" },
                    { $match: { 
                        $or: [
                            { "n1.n_name": "FRANCE", "n2.n_name": "GERMANY" },
                            { "n1.n_name": "GERMANY", "n2.n_name": "FRANCE" }
                        ]
                    }},
                    {
                        $group: {
                            _id: { supp_nation: "$n1.n_name", cust_nation: "$n2.n_name", l_year: { $year: "$lineitems.l_shipdate" } },
                            revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } }
                        }
                    },
                    { $sort: { "_id.supp_nation": 1, "_id.cust_nation": 1, "_id.l_year": 1 } }
                ]).toArray();
            },
            8: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderdate: { $gte: new Date('1995-01-01'), $lte: new Date('1996-12-31') } } },
                    { $unwind: "$lineitems" },
                    { $lookup: { from: "part", localField: "lineitems.l_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    { $match: { "p.p_type": "ECONOMY ANODIZED STEEL" } },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $lookup: { from: "nation", localField: "c.c_nationkey", foreignField: "n_nationkey", as: "n1" } },
                    { $unwind: "$n1" },
                    { $lookup: { from: "region", localField: "n1.n_regionkey", foreignField: "r_regionkey", as: "r" } },
                    { $unwind: "$r" },
                    { $match: { "r.r_name": "AMERICA" } },
                    { $lookup: { from: "supplier", localField: "lineitems.l_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n2" } },
                    { $unwind: "$n2" },
                    {
                        $group: {
                            _id: { $year: "$o_orderdate" },
                            total_volume: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } },
                            brazil_volume: {
                                $sum: {
                                    $cond: [{ $eq: ["$n2.n_name", "BRAZIL"] }, { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] }, 0]
                                }
                            }
                        }
                    },
                    { $project: { mkt_share: { $divide: ["$brazil_volume", "$total_volume"] } } },
                    { $sort: { _id: 1 } }
                ]).toArray();
            },
            9: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $lookup: { from: "part", localField: "lineitems.l_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    { $match: { "p.p_name": { $regex: /green/ } } },
                    { $lookup: { from: "supplier", localField: "lineitems.l_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    {
                        $lookup: {
                            from: "partsupp",
                            let: { pkey: "$lineitems.l_partkey", skey: "$lineitems.l_suppkey" },
                            pipeline: [
                                { $match: { $expr: { $and: [{ $eq: ["$ps_partkey", "$$pkey"] }, { $eq: ["$ps_suppkey", "$$skey"] }] } } }
                            ],
                            as: "ps"
                        }
                    },
                    { $unwind: "$ps" },
                    {
                        $group: {
                            _id: { nation: "$n.n_name", year: { $year: "$o_orderdate" } },
                            sum_profit: {
                                $sum: {
                                    $subtract: [
                                        { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] },
                                        { $multiply: ["$ps.ps_supplycost", "$lineitems.l_quantity"] }
                                    ]
                                }
                            }
                        }
                    },
                    { $sort: { "_id.nation": 1, "_id.year": -1 } }
                ]).toArray();
            },
            10: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderdate: { $gte: new Date('1993-10-01'), $lt: new Date('1994-01-01') } } },
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_returnflag": "R" } },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $lookup: { from: "nation", localField: "c.c_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    {
                        $group: {
                            _id: { custkey: "$c.c_custkey", name: "$c.c_name", acctbal: "$c.c_acctbal", phone: "$c.c_phone", nation: "$n.n_name", address: "$c.c_address", comment: "$c.c_comment" },
                            revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } }
                        }
                    },
                    { $sort: { revenue: -1 } },
                    { $limit: 20 }
                ]).toArray();
            },
            11: async () => {
                const thresholdResult = await partsuppCol.aggregate([
                    { $lookup: { from: "supplier", localField: "ps_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $match: { "n.n_name": "GERMANY" } },
                    { $group: { _id: null, total: { $sum: { $multiply: ["$ps_supplycost", "$ps_availqty"] } } } }
                ]).toArray();
                const threshold = thresholdResult[0] ? thresholdResult[0].total * 0.0001 : 0; 
        
                return await partsuppCol.aggregate([
                    { $lookup: { from: "supplier", localField: "ps_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $match: { "n.n_name": "GERMANY" } },
                    { $group: { _id: "$ps_partkey", value: { $sum: { $multiply: ["$ps_supplycost", "$ps_availqty"] } } } },
                    { $match: { value: { $gt: threshold } } },
                    { $sort: { value: -1 } }
                ]).toArray();
            },
            12: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { 
                        "lineitems.l_shipmode": { $in: ["MAIL", "SHIP"] },
                        "lineitems.l_receiptdate": { $gte: new Date('1994-01-01'), $lt: new Date('1995-01-01') },
                        $expr: {
                            $and: [
                                { $lt: ["$lineitems.l_commitdate", "$lineitems.l_receiptdate"] },
                                { $lt: ["$lineitems.l_shipdate", "$lineitems.l_commitdate"] }
                            ]
                        }
                    }},
                    {
                        $group: {
                            _id: "$lineitems.l_shipmode",
                            high_line_count: { $sum: { $cond: [{ $in: ["$o_orderpriority", ["1-URGENT", "2-HIGH"]] }, 1, 0] } },
                            low_line_count: { $sum: { $cond: [{ $not: { $in: ["$o_orderpriority", ["1-URGENT", "2-HIGH"]] } }, 1, 0] } }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray();
            },
            13: async () => {
                return await customerCol.aggregate([
                    {
                        $lookup: {
                            from: "orders",
                            localField: "c_custkey",
                            foreignField: "o_custkey",
                            pipeline: [
                                { $project: { o_comment: 1, _id: 0 } }, 
                                { $match: { o_comment: { $not: /special.*requests/ } } }
                            ],
                            as: "o"
                        }
                    },
                    { $project: { c_count: { $size: "$o" } } },
                    { $group: { _id: "$c_count", custdist: { $sum: 1 } } },
                    { $sort: { custdist: -1, _id: -1 } }
                ]).toArray();
            },
            14: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipdate": { $gte: new Date('1995-09-01'), $lt: new Date('1995-10-01') } } },
                    { $lookup: { from: "part", localField: "lineitems.l_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    {
                        $group: {
                            _id: null,
                            promo_revenue: {
                                $sum: {
                                    $cond: [
                                        { $regexMatch: { input: "$p.p_type", regex: /^PROMO/ } },
                                        { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] },
                                        0
                                    ]
                                }
                            },
                            total_revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } }
                        }
                    },
                    { $project: { _id: 0, promo_revenue: { $multiply: [100, { $divide: ["$promo_revenue", "$total_revenue"] }] } } }
                ]).toArray();
            },
            15: async () => {
                const revenueView = await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipdate": { $gte: new Date('1996-01-01'), $lt: new Date('1996-04-01') } } },
                    { $group: { _id: "$lineitems.l_suppkey", total_revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } } } },
                    { $sort: { total_revenue: -1 } }
                ]).toArray();
                
                if (revenueView.length > 0) {
                    const maxRevenue = revenueView[0].total_revenue;
                    const topSuppliers = revenueView.filter(s => s.total_revenue === maxRevenue).map(s => s._id);
                    return await supplierCol.find({ s_suppkey: { $in: topSuppliers } }).sort({ s_suppkey: 1 }).toArray();
                }
                return [];
            },
            16: async () => {
                const supplierComplaints = await supplierCol.find({ s_comment: /Customer.*Complaints/ }).map(s => s.s_suppkey).toArray();
                return await partsuppCol.aggregate([
                    { $match: { ps_suppkey: { $nin: supplierComplaints } } },
                    { $lookup: { from: "part", localField: "ps_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    { $match: { 
                        "p.p_brand": { $ne: "Brand#45" }, 
                        "p.p_type": { $not: /^MEDIUM POLISHED/ },
                        "p.p_size": { $in: [49, 14, 23, 45, 19, 3, 36, 9] }
                    }},
                    {
                        $group: {
                            _id: { brand: "$p.p_brand", type: "$p.p_type", size: "$p.p_size" },
                            suppliers: { $addToSet: "$ps_suppkey" } 
                        }
                    },
                    { $project: { supplier_cnt: { $size: "$suppliers" } } },
                    { $sort: { supplier_cnt: -1, "_id.brand": 1, "_id.type": 1, "_id.size": 1 } },
                    { $limit: 10 }
                ]).toArray();
            },
            17: async () => {
                return await partCol.aggregate([
                    { $match: { p_brand: "Brand#23", p_container: "MED BOX" } },
                    { $lookup: { from: "orders", localField: "p_partkey", foreignField: "lineitems.l_partkey", as: "o" } },
                    { $unwind: "$o" },
                    { $unwind: "$o.lineitems" },
                    { $match: { $expr: { $eq: ["$o.lineitems.l_partkey", "$p_partkey"] } } },
                    {
                        $group: {
                            _id: "$p_partkey",
                            items: { $push: "$o.lineitems" },
                            avg_qty: { $avg: "$o.lineitems.l_quantity" }
                        }
                    },
                    { $unwind: "$items" },
                    { $match: { $expr: { $lt: ["$items.l_quantity", { $multiply: [0.2, "$avg_qty"] }] } } },
                    { $group: { _id: null, avg_yearly: { $sum: { $divide: ["$items.l_extendedprice", 7.0] } } } }
                ]).toArray();
            },
            18: async () => {
                return await ordersCol.aggregate([
                    { $match: { $expr: { $gt: [{ $sum: "$lineitems.l_quantity" }, 300] } } },
                    { $lookup: { from: "customer", localField: "o_custkey", foreignField: "c_custkey", as: "c" } },
                    { $unwind: "$c" },
                    { $unwind: "$lineitems" },
                    {
                        $group: {
                            _id: { 
                                name: "$c.c_name", custkey: "$c.c_custkey", 
                                orderkey: "$o_orderkey", date: "$o_orderdate", totalprice: "$o_totalprice" 
                            },
                            sum_qty: { $sum: "$lineitems.l_quantity" }
                        }
                    },
                    { $sort: { "_id.totalprice": -1, "_id.date": 1 } },
                    { $limit: 100 }
                ]).toArray();
            },
            19: async () => {
                return await ordersCol.aggregate([
                    { $unwind: "$lineitems" },
                    { $match: { "lineitems.l_shipinstruct": "DELIVER IN PERSON", "lineitems.l_shipmode": { $in: ["AIR", "AIR REG"] } } },
                    { $lookup: { from: "part", localField: "lineitems.l_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    {
                        $match: {
                            $or: [
                                { "p.p_brand": "Brand#12", "p.p_container": { $in: ["SM CASE", "SM BOX", "SM PACK", "SM PKG"] }, "lineitems.l_quantity": { $gte: 1, $lte: 11 }, "p.p_size": { $gte: 1, $lte: 5 } },
                                { "p.p_brand": "Brand#23", "p.p_container": { $in: ["MED BAG", "MED BOX", "MED PKG", "MED PACK"] }, "lineitems.l_quantity": { $gte: 10, $lte: 20 }, "p.p_size": { $gte: 1, $lte: 10 } },
                                { "p.p_brand": "Brand#34", "p.p_container": { $in: ["LG CASE", "LG BOX", "LG PACK", "LG PKG"] }, "lineitems.l_quantity": { $gte: 20, $lte: 30 }, "p.p_size": { $gte: 1, $lte: 15 } }
                            ]
                        }
                    },
                    { $group: { _id: null, revenue: { $sum: { $multiply: ["$lineitems.l_extendedprice", { $subtract: [1, "$lineitems.l_discount"] }] } } } }
                ]).toArray();
            },
            20: async () => {
                return await supplierCol.aggregate([
                    { $lookup: { from: "nation", localField: "s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $match: { "n.n_name": "CANADA" } },
                    { $lookup: { from: "partsupp", localField: "s_suppkey", foreignField: "ps_suppkey", as: "ps" } },
                    { $unwind: "$ps" },
                    { $lookup: { from: "part", localField: "ps.ps_partkey", foreignField: "p_partkey", as: "p" } },
                    { $unwind: "$p" },
                    { $match: { "p.p_name": { $regex: /^forest/ } } },
                    { $lookup: { from: "orders", localField: "ps.ps_partkey", foreignField: "lineitems.l_partkey", as: "o" } },
                    { $unwind: "$o" },
                    { $unwind: "$o.lineitems" },
                    { $match: { 
                        $expr: { $and: [{ $eq: ["$o.lineitems.l_partkey", "$ps.ps_partkey"] }, { $eq: ["$o.lineitems.l_suppkey", "$s_suppkey"] }] },
                        "o.lineitems.l_shipdate": { $gte: new Date('1994-01-01'), $lt: new Date('1995-01-01') }
                    }},
                    { $group: { _id: { suppkey: "$s_suppkey", name: "$s_name", address: "$s_address", availqty: "$ps.ps_availqty" }, sum_qty: { $sum: "$o.lineitems.l_quantity" } } },
                    { $match: { $expr: { $gt: ["$_id.availqty", { $multiply: [0.5, "$sum_qty"] }] } } },
                    { $project: { s_name: "$_id.name", s_address: "$_id.address" } },
                    { $sort: { s_name: 1 } }
                ]).toArray();
            },
            21: async () => {
                return await ordersCol.aggregate([
                    { $match: { o_orderstatus: "F" } },
                    { $unwind: "$lineitems" },
                    { $match: { $expr: { $gt: ["$lineitems.l_receiptdate", "$lineitems.l_commitdate"] } } },
                    { $lookup: { from: "supplier", localField: "lineitems.l_suppkey", foreignField: "s_suppkey", as: "s" } },
                    { $unwind: "$s" },
                    { $lookup: { from: "nation", localField: "s.s_nationkey", foreignField: "n_nationkey", as: "n" } },
                    { $unwind: "$n" },
                    { $match: { "n.n_name": "SAUDI ARABIA" } },
                    { $group: { _id: "$s.s_name", numwait: { $sum: 1 } } },
                    { $sort: { numwait: -1, _id: 1 } },
                    { $limit: 100 }
                ]).toArray();
            },
            22: async () => {
                const avgBalResult = await customerCol.aggregate([
                    { $match: { c_acctbal: { $gt: 0.00 }, c_phone: { $regex: /^(13|31|23|29|30|18|17)/ } } },
                    { $group: { _id: null, avg: { $avg: "$c_acctbal" } } }
                ]).toArray();
                const avgBal = avgBalResult[0] ? avgBalResult[0].avg : 0;
        
                return await customerCol.aggregate([
                    { $match: { c_phone: { $regex: /^(13|31|23|29|30|18|17)/ }, c_acctbal: { $gt: avgBal } } },
                    { $lookup: { from: "orders", localField: "c_custkey", foreignField: "o_custkey", as: "o" } },
                    { $match: { "o": { $size: 0 } } },
                    { $group: { _id: { $substr: ["$c_phone", 0, 2] }, numcust: { $sum: 1 }, totacctbal: { $sum: "$c_acctbal" } } },
                    { $sort: { _id: 1 } }
                ]).toArray();
            }
        };

        // EXECUTOR DE QUERIES
        for (const numQuery of QUERIES_A_EXECUTAR) {
            if (queries[numQuery]) {
                console.log(`\nExecutando QUERY ${numQuery}...`);
                
                console.time(`Tempo Q${numQuery}`);
                const resultados = await queries[numQuery]();
                console.timeEnd(`Tempo Q${numQuery}`);

                if (MOSTRAR_RESULTADOS) {
                    console.log(`\nResultados Q${numQuery} (Exibindo até 10 linhas):`);

                    const tabelaFormatada = resultados.slice(0, 10).map(row => { // se quiser aumentar a qtd de linhas da tabela exibida é aqui
                        const newRow = { ...row };

                        if (newRow._id === null) {
                            delete newRow._id;
                        } 
                        else if (newRow._id && (newRow._id._bsontype === 'ObjectID' || newRow._id instanceof Buffer || newRow._id.buffer)) {
                            delete newRow._id;
                        }
                        else if (newRow._id && typeof newRow._id === 'object') {
                            const idObj = newRow._id;
                            delete newRow._id;
                            Object.assign(newRow, idObj);
                        }   
                        return newRow;
                    });
                    
                    if (tabelaFormatada.length > 0) {
                        console.table(tabelaFormatada);
                    } else {
                        console.log("Nenhum resultado encontrado.");
                    }
                }
            } else {
                console.log(`A Query ${numQuery} não existe!`);
            }
        }

    } catch (erro) {
        console.error('\nErro durante a execução das consultas:', erro);
    } finally {
        await client.close();
        console.log('\nBenchmark Finalizado com Sucesso.');
    }
}

rodarConsultas();