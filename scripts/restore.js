require('dotenv').config()
const fs=require('fs/promises')
const path=require('path')
const db=require('../config/db')
const {ensureCommerceSchema}=require('../lib/commerceSchema')
const {runMigrations}=require('../lib/migrationRunner')
const ORDER=['categories','delivery_companies','users','foods','reviews','orders','order_items','addresses','promotions','wallet_transactions','wallet_topups','vouchers','voucher_usages','favorites','notifications','flash_sales','support_tickets','ticket_messages','audit_logs','password_reset_codes','ai_memory','ai_feedback','ai_corrections','ai_training_examples','ai_conversations','rag_documents']
function placeholders(n){return Array.from({length:n},()=>'?').join(',')}
;(async()=>{try{const file=process.env.RESTORE_FILE||process.argv[2];if(!file)throw new Error('Usage: RESTORE_CONFIRM=YES npm run restore -- backups/file.json');if(process.env.RESTORE_CONFIRM!=='YES')throw new Error('Set RESTORE_CONFIRM=YES to confirm destructive restore');const data=JSON.parse(await fs.readFile(path.resolve(file),'utf8'));await db.ready();await ensureCommerceSchema();await runMigrations();await db.transaction(async tx=>{for(const table of [...ORDER].reverse()){if(Array.isArray(data.tables?.[table]))await tx.query(`DELETE FROM ${table}`)}for(const table of ORDER){const rows=data.tables?.[table];if(!Array.isArray(rows)||!rows.length)continue;for(const row of rows){const keys=Object.keys(row);await tx.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders(keys.length)})`,keys.map(k=>row[k]))}}});console.log(`Restore complete from ${file}`);await db.close()}catch(e){console.error(e.message||e);process.exitCode=1}})()
