const crypto = require('crypto')
const db = require('../config/db')
const walletLedger = require('./walletLedger')
const commerce = require('./commerceService')

let ready = false
async function ensureSchema(){if(ready)return;await db.ready();const sqlite=`CREATE TABLE IF NOT EXISTS wallet_topups (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL,amount REAL NOT NULL,reference_code TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',approved_by TEXT DEFAULT '',note TEXT DEFAULT '',created_at DATETIME DEFAULT CURRENT_TIMESTAMP,approved_at DATETIME NULL)`;const mysql=`CREATE TABLE IF NOT EXISTS wallet_topups (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(255) NOT NULL,amount DECIMAL(12,2) NOT NULL,reference_code VARCHAR(64) NOT NULL UNIQUE,status VARCHAR(32) NOT NULL DEFAULT 'pending',approved_by VARCHAR(255) DEFAULT '',note TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,approved_at TIMESTAMP NULL)`;try{await db.query(sqlite)}catch(_){await db.query(mysql)}ready=true}
function validAmount(v){const n=Math.round(Number(v||0));return Number.isFinite(n)&&n>=1000&&n<=100000000?n:0}
function makeReference(username){return `NAP-${String(username||'USER').replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}
async function createRequest(username,amount){await ensureSchema();const n=validAmount(amount);if(!n)throw new Error('Số tiền nạp không hợp lệ');const code=makeReference(username);const [result]=await db.query("INSERT INTO wallet_topups(username,amount,reference_code,status) VALUES(?,?,?,'pending')",[username,n,code]);return getById(result.insertId)}
async function getById(id){await ensureSchema();const [rows]=await db.query('SELECT * FROM wallet_topups WHERE id=?',[id]);return rows[0]||null}
async function listForUser(username){await ensureSchema();const [rows]=await db.query('SELECT * FROM wallet_topups WHERE username=? ORDER BY id DESC LIMIT 20',[username]);return rows}
async function listAll(){await ensureSchema();const [rows]=await db.query("SELECT * FROM wallet_topups ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 200");return rows}
async function approve(id,adminUsername){
  await ensureSchema();const item=await getById(id);if(!item||item.status!=='pending')throw new Error('Yêu cầu không tồn tại hoặc đã xử lý')
  const [result]=await db.query("UPDATE wallet_topups SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",[adminUsername,id]);if(!result.affectedRows)throw new Error('Yêu cầu đã được xử lý')
  try{
    await walletLedger.recordTransaction({username:item.username,type:'topup',amount:Number(item.amount),referenceType:'topup',referenceId:id,note:`Nạp ví ${item.reference_code}`})
    await commerce.notify(item.username,'Nạp tiền thành công',`${Number(item.amount).toLocaleString('vi-VN')}đ đã được cộng vào ví.`, '/wallet/history')
    await commerce.audit(adminUsername,'approve_topup','topup',id,`amount=${item.amount}; user=${item.username}`)
  }catch(error){await db.query("UPDATE wallet_topups SET status='pending',approved_by='',approved_at=NULL WHERE id=? AND status='approved'",[id]).catch(()=>{});throw error}
  return getById(id)
}
async function reject(id,adminUsername,note){await ensureSchema();const item=await getById(id);const [result]=await db.query("UPDATE wallet_topups SET status='rejected',approved_by=?,note=?,approved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",[adminUsername,String(note||'').slice(0,500),id]);if(!result.affectedRows)throw new Error('Yêu cầu không tồn tại hoặc đã xử lý');if(item)await commerce.notify(item.username,'Yêu cầu nạp tiền bị từ chối',String(note||'Shop chưa xác nhận được giao dịch.'),'/wallet/top-up');await commerce.audit(adminUsername,'reject_topup','topup',id,note||'');return getById(id)}
module.exports={ensureSchema,validAmount,createRequest,getById,listForUser,listAll,approve,reject}
