const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "27032006",
  database: "news_db"
});

module.exports = db;