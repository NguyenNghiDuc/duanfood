const fs=require('fs/promises')
const path=require('path')
const db=require('../config/db')

async function ensureTable(){await db.ready();try{await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY,name TEXT NOT NULL,applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)}catch(_){await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY,name VARCHAR(255) NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)}}
async function applied(){await ensureTable();const [rows]=await db.query('SELECT version FROM schema_migrations');return new Set(rows.map(r=>String(r.version)))}
async function runMigrations(){await ensureTable();const done=await applied(),dir=path.join(__dirname,'..','migrations');let files=[];try{files=(await fs.readdir(dir)).filter(f=>/^\d+.*\.js$/.test(f)).sort()}catch(_){return[]}const ran=[];for(const file of files){const version=file.split('_')[0].replace('.js','');if(done.has(version))continue;const migration=require(path.join(dir,file));await db.transaction(async tx=>{await migration.up(tx,db.engine());await tx.query('INSERT INTO schema_migrations(version,name) VALUES(?,?)',[version,migration.name||file])});ran.push(version)}return ran}
module.exports={runMigrations,ensureTable}
