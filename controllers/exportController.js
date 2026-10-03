const db = require('../config/db')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function workbook(sheetName,rows,columns){
  const header=columns.map(c=>`<Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('')
  const body=rows.map(row=>`<Row>${columns.map(c=>{const value=row[c.key];const numeric=c.numeric&&value!==null&&value!==''&&Number.isFinite(Number(value));return `<Cell><Data ss:Type="${numeric?'Number':'String'}">${esc(numeric?Number(value):value)}</Data></Cell>`}).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${esc(sheetName)}"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`
}
function sendXls(res,name,sheet,rows,columns){res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${name}.xls"`);res.send('\ufeff'+workbook(sheet,rows,columns))}

async function exportExcel(req,res,next){
  try{
    await ensureCommerceSchema();const type=req.params.type
    if(type==='orders'){const [rows]=await db.query('SELECT id,username,total,shipping_fee,discount_amount,payment_method,status,created_at FROM orders ORDER BY id DESC');return sendXls(res,'orders','Orders',rows,[{key:'id',label:'ID',numeric:true},{key:'username',label:'Khách hàng'},{key:'total',label:'Tiền hàng',numeric:true},{key:'shipping_fee',label:'Phí ship',numeric:true},{key:'discount_amount',label:'Giảm giá',numeric:true},{key:'payment_method',label:'Thanh toán'},{key:'status',label:'Trạng thái'},{key:'created_at',label:'Ngày tạo'}])}
    if(type==='users'){const [rows]=await db.query('SELECT username,fullname,balance,role,locked,email,phone FROM users ORDER BY id DESC');return sendXls(res,'users','Users',rows,[{key:'username',label:'Username'},{key:'fullname',label:'Họ tên'},{key:'balance',label:'Số dư',numeric:true},{key:'role',label:'Role'},{key:'locked',label:'Khóa',numeric:true},{key:'email',label:'Email'},{key:'phone',label:'SĐT'}])}
    if(type==='wallet'){const [rows]=await db.query('SELECT id,username,type,amount,balance_before,balance_after,note,created_at FROM wallet_transactions ORDER BY id DESC');return sendXls(res,'wallet','Wallet',rows,[{key:'id',label:'ID',numeric:true},{key:'username',label:'User'},{key:'type',label:'Loại'},{key:'amount',label:'Số tiền',numeric:true},{key:'balance_before',label:'Trước',numeric:true},{key:'balance_after',label:'Sau',numeric:true},{key:'note',label:'Ghi chú'},{key:'created_at',label:'Ngày'}])}
    return res.status(404).send('Loại export không tồn tại')
  }catch(e){next(e)}
}
module.exports={exportExcel}
