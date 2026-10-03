const crypto = require('crypto')
const qs = require('querystring')

function configured(){return Boolean(process.env.VNP_TMN_CODE&&process.env.VNP_HASH_SECRET&&process.env.VNP_URL&&process.env.VNP_RETURN_URL)}
function pad(n){return String(n).padStart(2,'0')}
function formatDate(d){return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}
function sortObject(obj){return Object.keys(obj).sort().reduce((a,k)=>{a[k]=obj[k];return a},{})}
function encodeParams(params){return Object.entries(sortObject(params)).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%20/g,'+')}`).join('&')}
function sign(params){return crypto.createHmac('sha512',process.env.VNP_HASH_SECRET).update(Buffer.from(encodeParams(params),'utf-8')).digest('hex')}

function createPaymentUrl({orderId,amount,ip,locale='vn',bankCode=''}){
  if(!configured())throw new Error('VNPay chưa được cấu hình')
  const now=new Date(),expire=new Date(now.getTime()+15*60*1000)
  const params={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:process.env.VNP_TMN_CODE,vnp_Locale:locale,vnp_CurrCode:'VND',vnp_TxnRef:String(orderId),vnp_OrderInfo:`Thanh toan don hang ${orderId}`,vnp_OrderType:'other',vnp_Amount:Math.round(Number(amount||0)*100),vnp_ReturnUrl:process.env.VNP_RETURN_URL,vnp_IpAddr:ip||'127.0.0.1',vnp_CreateDate:formatDate(now),vnp_ExpireDate:formatDate(expire)}
  if(bankCode)params.vnp_BankCode=bankCode
  const secureHash=sign(params)
  return `${process.env.VNP_URL}?${encodeParams({...params,vnp_SecureHash:secureHash})}`
}

function verify(query){
  const input={...query},received=String(input.vnp_SecureHash||'');delete input.vnp_SecureHash;delete input.vnp_SecureHashType
  const expected=sign(input)
  if(!received||received.length!==expected.length)return false
  return crypto.timingSafeEqual(Buffer.from(received),Buffer.from(expected))
}
function success(query){return String(query.vnp_ResponseCode)==='00'&&String(query.vnp_TransactionStatus||'00')==='00'}
module.exports={configured,createPaymentUrl,verify,success}
