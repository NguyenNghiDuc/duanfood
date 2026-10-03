require('dotenv').config()
const bcrypt=require('bcryptjs')
const db=require('../config/db')
const userModel=require('../models/userModels')
const foodModel=require('../models/foodModels')
const {ensureCommerceSchema}=require('../lib/commerceSchema')
const {runMigrations}=require('../lib/migrationRunner')

async function ensureUser(username,password,role,fullname){let user=await userModel.findByUsername(username);if(!user){const hash=await bcrypt.hash(password,12);await userModel.createUser({username,password:hash,fullname,email:`${username}@example.local`});user=await userModel.findByUsername(username)}await db.query('UPDATE users SET role=?,locked=0 WHERE username=?',[role,username]);return user}

;(async()=>{try{await db.ready();await ensureCommerceSchema();await runMigrations();const admin=process.env.SEED_ADMIN_USERNAME||'admin',adminPass=process.env.SEED_ADMIN_PASSWORD||'ChangeMe123!',demo=process.env.SEED_USER_USERNAME||'demo',demoPass=process.env.SEED_USER_PASSWORD||'Demo12345!';await ensureUser(admin,adminPass,'super_admin','MINI FOOD Admin');await ensureUser(demo,demoPass,'user','Demo User');const [countRows]=await db.query('SELECT COUNT(*) total FROM foods');if(!Number(countRows[0]?.total)){const cats=await foodModel.getAllCategories(),cat=cats[0]?.id||null;const samples=[['Cơm gà MINI','Cơm gà dễ ăn, phù hợp bữa trưa',45000,'gà, cơm'],['Salad ức gà','Ít dầu, giàu protein',52000,'ức gà, rau xanh'],['Mì hải sản cay','Mì hải sản vị cay',59000,'mì, tôm, mực, ớt'],['Nước cam','Nước cam mát lạnh',25000,'cam']];for(const [title,description,price,ingredients] of samples)await foodModel.createFood({title,description,price,category_id:cat,image:'',ingredients,stock:50,low_stock_threshold:5})}console.log(`Seed complete. Admin=${admin}, demo=${demo}`);await db.close()}catch(e){console.error(e);process.exitCode=1}})()
