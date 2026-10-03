const crypto = require('crypto')
const db = require('../config/db')
const walletLedger = require('./walletLedger')
const commerce = require('./commerceService')

let ready = false
async function ensureSchema(){if(ready)return;await db.ready();const sqlite=`CREATE TABLE IF NOT EXISTS wallet_topups (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL,amount REAL NOT NULL,reference_code TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',approved_by TEXT DEFAULT '',note TEXT DEFAULT '',created_at DATETIME DEFAULT CURRENT_TIMESTAMP,approved_at DATETIME NULL)`;const mysql=`CREATE TABLE IF NOT EXISTS wallet_topups (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(255) NOT NULL,amount DECIMAL(12,2) NOT NULL,reference_code VARCHAR(64) NOT NULL UNIQUE,status VARCHAR(32) NOT NULL DEFAULT 'pending',approved_by VARCHAR(255) DEFAULT '',note TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,approved_at TIMESTAMP NULL)`;try{await db.query(sqlite)}catch(_){await db.query(mysql)}ready=true}
function validAmount(v){const n=Math.round(Number(v||0));return Number.isFinite(n)&&n>=1000&&n<=100000000?n:0}
function makeReference(username){return `NAP-${String(username||'USER').replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}
async function createRequest(username,amount){await ensureSchema();const n=validAmount(amount);if(!n)throw new Error('Số tiền nạp không hợp lệ');const code=makeReference(username);const [result]=await db.query("INSERT INTO wallet_topups(username,amount,reference_code,status) VALUES(?,?,?,'pending')",[username,n,code]);return getById(result.insertId)}
async function getById(id,client=db){await ensureSchema();const [rows]=await client.query('SELECT * FROM wallet_topups WHERE id=?',[id]);return rows[0]||null}
async function listForUser(username,limit=20,offset=0){await ensureSchema();const l=Math.min(Math.max(Number(limit)||20,1),100),o=Math.max(Number(offset)||0,0);const [rows]=await db.query(`SELECT * FROM wallet_topups WHERE username=? ORDER BY id DESC LIMIT ${l} OFFSET ${o}`,[username]);return rows}
async function listAll(limit=200,offset=0){await ensureSchema();const l=Math.min(Math.max(Number(limit)||200,1),500),o=Math.max(Number(offset)||0,0);const [rows]=await db.query(`SELECT * FROM wallet_topups ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT ${l} OFFSET ${o}`);return rows}
async function approve(id,adminUsername){
  await ensureSchema()
  const item=await db.transaction(async tx=>{
    const current=await getById(id,tx)
    if(!current||current.status!=='pending')throw new Error('Yêu cầu không tồn tại hoặc đã xử lý')
    const [result]=await tx.query("UPDATE wallet_topups SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",[adminUsername,id])
    if(!result.affectedRows)throw new Error('Yêu cầu đã được xử lý')
    await walletLedger.recordTransaction({username:current.username,type:'topup',amount:Number(current.amount),referenceType:'topup',referenceId:id,note:`Nạp ví ${current.reference_code}`},tx)
    await tx.query('INSERT INTO audit_logs(actor,action,target_type,target_id,detail) VALUES(?,?,?,?,?)',[adminUsername,'approve_topup','topup',String(id),`amount=${current.amount}; user=${current.username}`])
    return current
  })
  await commerce.notify(item.username,'Nạp tiền thành công',`${Number(item.amount).toLocaleString('vi-VN')}đ đã được cộng vào ví.`,'/wallet/history').catch(()=>{})
  return getById(id)
}
async function reject(id,adminUsername,note){
  await ensureSchema()
  const item=await db.transaction(async tx=>{const current=await getById(id,tx);const [result]=await tx.query("UPDATE wallet_topups SET status='rejected',approved_by=?,note=?,approved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",[adminUsername,String(note||'').slice(0,500),id]);if(!result.affectedRows)throw new Error('Yêu cầu không tồn tại hoặc đã xử lý');await tx.query('INSERT INTO audit_logs(actor,action,target_type,target_id,detail) VALUES(?,?,?,?,?)',[adminUsername,'reject_topup','topup',String(id),String(note||'').slice(0,1000)]);return current})
  if(item)await commerce.notify(item.username,'Yêu cầu nạp tiền bị từ chối',String(note||'Shop chưa xác nhận được giao dịch.'),'/wallet/top-up').catch(()=>{})
  return getById(id)
}
module.exports={ensureSchema,validAmount,createRequest,getById,listForUser,listAll,approve,reject}
