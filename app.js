require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const db = require('./config/db')
const app = express()
const port = Number(process.env.PORT || 5000)
const host = process.env.HOST || 'localhost'
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production')

app.disable('x-powered-by')
if (isProduction) app.set('trust proxy', 1)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next()})
app.use(express.json({limit:'2mb'}))
app.use(express.urlencoded({extended:true,limit:'2mb'}))
app.use(express.static(path.join(__dirname,'public'),{maxAge:isProduction?'1d':0}))

app.use(session({name:'mini_food_sid',secret:process.env.SESSION_SECRET||'development-only-change-me',resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:isProduction,sameSite:'lax',maxAge:7*24*60*60*1000}}))

app.use((req,res,next)=>{res.locals.user=req.session.user||null;if(!req.session.cart)req.session.cart=[];res.locals.cartCount=req.session.cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);next()})

app.use((req,res,next)=>{
  const originalRender=res.render.bind(res)
  res.render=(view,options={},callback)=>{
    const merged={...res.locals,...(typeof options==='object'?options:{})}
    const done=(err,html)=>{
      if(err){if(typeof callback==='function')return callback(err);return next(err)}
      try{
        const seo=merged.seo||{}
        const title=String(seo.title||'MINI FOOD').replace(/[<>]/g,'')
        const description=String(seo.description||'MINI FOOD - đặt món, thanh toán ví và theo dõi đơn hàng.').replace(/[<>]/g,'').slice(0,180)
        const image=String(seo.image||'/images/anhfood.png').replace(/["<>]/g,'')
        const head=[
          '<link rel="stylesheet" href="/css/theme.css">',
          '<link rel="manifest" href="/manifest.json">',
          '<meta name="theme-color" content="#ff6b35">',
          `<meta name="description" content="${description.replace(/"/g,'&quot;')}">`,
          `<meta property="og:title" content="${title.replace(/"/g,'&quot;')}">`,
          `<meta property="og:description" content="${description.replace(/"/g,'&quot;')}">`,
          `<meta property="og:image" content="${image}">`,
          '<meta property="og:type" content="website">'
        ].join('\n')
        const appData={user:res.locals.user?{username:res.locals.user.username,balance:Number(res.locals.user.balance||0),role:res.locals.user.role||'user'}:null,cartCount:Number(res.locals.cartCount||0)}
        const foot=[
          '<link rel="stylesheet" href="/css/chat-widget.css">',
          `<script>window.__MINI_FOOD_APP=${JSON.stringify(appData).replace(/</g,'\\u003c')};</script>`,
          '<script src="/js/app-ui.js" defer></script>',
          '<script src="/js/chat-widget.js" defer></script>'
        ].join('\n')
        if(typeof html==='string'){
          if(!html.includes('/manifest.json'))html=html.replace(/<\/head>/i,head+'\n</head>')
          else if(!html.includes('/css/theme.css'))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/theme.css">\n</head>')
          if(!html.includes('/js/app-ui.js'))html=html.replace(/<\/body>/i,foot+'\n</body>')
        }
      }catch(_){}
      if(typeof callback==='function')return callback(null,html)
      return res.send(html)
    }
    return originalRender(view,merged,done)
  }
  next()
})

app.get('/api/foods',async(req,res)=>{try{const foodModel=require('./models/foodModels');res.json(await foodModel.getFoods({}))}catch(_){res.status(500).json({error:'cannot load foods'})}})
if(!isProduction)app.post('/_ping',(req,res)=>res.json({ok:true}))
app.use('/',require('./routes'))
const {notFoundHandler,errorHandler}=require('./middleware/errorHandles')
app.use(notFoundHandler);app.use(errorHandler)

let server=null,shuttingDown=false
async function gracefulShutdown(signal){if(shuttingDown)return;shuttingDown=true;console.log(`Received ${signal}, shutting down...`);try{if(server)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));await db.close().catch(()=>{});process.exit(0)}catch(error){console.error('Shutdown failed:',error.message);process.exit(1)}}
if(require.main===module){db.ready().then(()=>{server=app.listen(port,host,()=>console.log(`Server is running at http://${host}:${port}`))}).catch(error=>{console.error('Database initialization failed:',error);process.exit(1)});process.on('SIGINT',()=>gracefulShutdown('SIGINT'));process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'))}else module.exports=app

;(async()=>{try{await db.ready();const {ensureCommerceSchema}=require('./lib/commerceSchema');await ensureCommerceSchema();const chatIndex=require('./lib/chatIndex');const items=await chatIndex.buildIndex();const fs=require('fs');const outDir=path.join(__dirname,'public','data');fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'chat-index.json'),JSON.stringify(items,null,2),'utf8')}catch(error){console.error('[startup] optional initialization failed:',error.message)}})()
