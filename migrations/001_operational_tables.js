module.exports={
  name:'operational tables for payments, outbox and backups',
  async up(tx,engine){
    if(engine==='mysql'){
      await tx.query(`CREATE TABLE IF NOT EXISTS payment_events (id INT AUTO_INCREMENT PRIMARY KEY,provider VARCHAR(50) NOT NULL,event_key VARCHAR(255) NOT NULL UNIQUE,order_id INT NULL,payload LONGTEXT,status VARCHAR(50) DEFAULT 'received',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
      await tx.query(`CREATE TABLE IF NOT EXISTS outbox_events (id INT AUTO_INCREMENT PRIMARY KEY,event_type VARCHAR(100) NOT NULL,payload LONGTEXT NOT NULL,processed TINYINT DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,processed_at TIMESTAMP NULL)`)
      await tx.query(`CREATE TABLE IF NOT EXISTS backup_runs (id INT AUTO_INCREMENT PRIMARY KEY,engine VARCHAR(20) NOT NULL,file_path VARCHAR(1000) NOT NULL,row_count INT DEFAULT 0,status VARCHAR(50) DEFAULT 'ok',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    }else{
      await tx.query(`CREATE TABLE IF NOT EXISTS payment_events (id INTEGER PRIMARY KEY AUTOINCREMENT,provider TEXT NOT NULL,event_key TEXT NOT NULL UNIQUE,order_id INTEGER,payload TEXT,status TEXT DEFAULT 'received',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
      await tx.query(`CREATE TABLE IF NOT EXISTS outbox_events (id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,payload TEXT NOT NULL,processed INTEGER DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,processed_at DATETIME NULL)`)
      await tx.query(`CREATE TABLE IF NOT EXISTS backup_runs (id INTEGER PRIMARY KEY AUTOINCREMENT,engine TEXT NOT NULL,file_path TEXT NOT NULL,row_count INTEGER DEFAULT 0,status TEXT DEFAULT 'ok',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
    }
  }
}
