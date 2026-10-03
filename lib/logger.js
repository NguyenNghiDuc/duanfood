const crypto = require('crypto')

function notifyError(payload){if(!process.env.ERROR_WEBHOOK_URL)return;fetch(process.env.ERROR_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json',...(process.env.ERROR_WEBHOOK_TOKEN?{authorization:`Bearer ${process.env.ERROR_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify(payload)}).catch(()=>{})}
function log(level,message,meta={}){const payload={time:new Date().toISOString(),level,message,...meta},line=JSON.stringify(payload);if(level==='error'){console.error(line);notifyError(payload)}else if(level==='warn')console.warn(line);else console.log(line)}
function requestLogger(req,res,next){const started=Date.now(),id=req.get('x-request-id')||crypto.randomUUID();req.id=id;res.setHeader('X-Request-Id',id);res.on('finish',()=>log('info','http_request',{requestId:id,method:req.method,path:req.originalUrl,status:res.statusCode,durationMs:Date.now()-started,user:req.session?.user?.username||null}));next()}
module.exports={log,requestLogger}
