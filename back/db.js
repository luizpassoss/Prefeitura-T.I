const mysql = require('mysql2/promise');

// Conexão com o banco "inventario"
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // altere para sua senha
    database: 'inventario',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
