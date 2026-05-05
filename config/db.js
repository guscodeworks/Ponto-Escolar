require('dotenv').config();

const mysql = require('mysql2');

const db = mysql.createConnection({
        database: process.env.DB,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
});

db.connect((err) => {
    if(err) {
        console.error("Erro", err);
         return
    } 
        console.log("Conectado no MySQL");
});