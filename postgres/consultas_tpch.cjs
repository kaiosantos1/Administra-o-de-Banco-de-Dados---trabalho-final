const { Client } = require('pg');
const fs         = require('fs');
const path       = require('path');

const DB_CONFIG = {
    host:     'localhost',
    port:     5432,
    database: 'tpch',
    user:     'postgres',
    password: ' ', // Coloque a sua senha aqui
};
const SCHEMA = 'tpc-h';
const QUERIES_DIR = path.join(__dirname, 'queries');
const MOSTRAR_RESULTADOS = true;

const args = process.argv.slice(2);
let QUERIES_A_EXECUTAR = [];

if (args.length === 0) {
    console.log('ATENÇÃO: Indique qual query deseja executar.');
    console.log('Exemplo 1 (uma query):    node consultas_tpch.cjs 10');
    console.log('Exemplo 2 (várias):       node consultas_tpch.cjs 1 3 13');
    console.log('Exemplo 3 (todas):        node consultas_tpch.cjs all\n');
    process.exit(0);
}

if (args[0].toLowerCase() === 'all') {
    QUERIES_A_EXECUTAR = Array.from({ length: 22 }, (_, i) => i + 1);
} else {
    QUERIES_A_EXECUTAR = args.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 22);
    if (QUERIES_A_EXECUTAR.length === 0) {
        console.log("Argumentos inválidos. Use números de 1 a 22 ou a palavra 'all'.");
        process.exit(1);
    }
}

async function rodarConsultas() {
    const client = new Client(DB_CONFIG);
    try {
        await client.connect();
        await client.query(`SET search_path TO "tpc-h"`);
        console.log('INICIANDO BENCHMARK TPC-H NO POSTGRESQL\n');

        for (const numQuery of QUERIES_A_EXECUTAR) {
            const sqlFile = path.join(QUERIES_DIR, `${numQuery}.sql`);
            if (!fs.existsSync(sqlFile)) {
                console.log(`\nArquivo não encontrado: ${sqlFile} — pulando.`);
                continue;
            }

            const sql = fs.readFileSync(sqlFile, 'utf8');
            console.log(`\nExecutando QUERY ${numQuery}...`);

            try {
                if (numQuery === 15) {
                    // Query 15 tem CREATE VIEW + SELECT + DROP VIEW
                    const partes = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.time(`Tempo Q${numQuery}`);
                    await client.query(partes[0]); // CREATE VIEW
                    const resultado = await client.query(partes[1]); // SELECT
                    await client.query(partes[2]); // DROP VIEW
                    console.timeEnd(`Tempo Q${numQuery}`);

                    if (MOSTRAR_RESULTADOS) {
                        console.log(`\nResultados Q${numQuery} (Exibindo até 10 linhas):`);
                        if (resultado.rows.length > 0) {
                            console.table(resultado.rows.slice(0, 10));
                        } else {
                            console.log('Nenhum resultado encontrado.');
                        }
                    }
                } else {
                    console.time(`Tempo Q${numQuery}`);
                    const resultado = await client.query(sql);
                    console.timeEnd(`Tempo Q${numQuery}`);

                    if (MOSTRAR_RESULTADOS) {
                        const linhas = resultado.rows;
                        console.log(`\nResultados Q${numQuery} (Exibindo até 10 linhas):`);
                        if (linhas.length > 0) {
                            console.table(linhas.slice(0, 10));
                        } else {
                            console.log('Nenhum resultado encontrado.');
                        }
                    }
                }
            } catch (erro) {
                console.error(`\nErro na Query ${numQuery}:`, erro.message);
            }
        }
    } catch (erro) {
        console.error('\nErro durante a execução das consultas:', erro);
    } finally {
        await client.end();
        console.log('\nBenchmark Finalizado com Sucesso.');
    }
}

rodarConsultas();