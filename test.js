const mysql = require("mysql2/promise");

async function createDB() {
  try {
    const conn = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "27032006"
    });

    await conn.query("CREATE DATABASE IF NOT EXISTS newsdb");
    await conn.query("USE newsdb");
    await conn.query(
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        fullname VARCHAR(255)
      )`
    );
    await conn.query(
      `CREATE TABLE IF NOT EXISTS news (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL
      )`
    );
    console.log("Tạo database và bảng newsdb thành công!");

    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

createDB();