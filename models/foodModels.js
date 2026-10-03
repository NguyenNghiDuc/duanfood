const db=require('../config/db')
const {ensureCommerceSchema}=require('../lib/commerceSchema')

function normalizeText(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim()}
async function ready(){await db.ready();await ensureCommerceSchema()}
async function initFoodSchema(){await ready()}
async function getAllCategories(){await ready();const [rows]=await db.query('SELECT * FROM categories ORDER BY id ASC');return rows}
async function addCategory(name){await ready();const clean=String(name||'').trim();if(!clean)throw new Error('Tên danh mục không hợp lệ');const [result]=await db.query('INSERT INTO categories(name) VALUES(?)',[clean]);return result.insertId}
async function deleteCategory(id){await ready();await db.query('DELETE FROM categories WHERE id=?',[Number(id)])}

async function getFoods({keyword='',categoryId='',minPrice=null,maxPrice=null,minRating=null,sort='newest',limit=50}={}){
  await ready()
  let sql=`SELECT f.*,c.name AS category_name,
    COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.food_id=f.id),0) AS avg_rating,
    COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.food_id=f.id),0) AS review_count,
    COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.food_id=f.id AND o.status<>'Đã hủy'),0) AS sold_count
    FROM foods f LEFT JOIN categories c ON c.id=f.category_id WHERE 1=1`
  const params=[]
  if(keyword){const k=`%${String(keyword).toLowerCase()}%`;sql+=` AND (LOWER(f.title) LIKE ? OR LOWER(COALESCE(f.description,'')) LIKE ? OR LOWER(COALESCE(f.ingredients,'')) LIKE ? OR LOWER(COALESCE(c.name,'')) LIKE ?)`;params.push(k,k,k,k)}
  if(categoryId){sql+=' AND f.category_id=?';params.push(categoryId)}
  if(minPrice!==null&&Number.isFinite(Number(minPrice))){sql+=' AND f.price>=?';params.push(Number(minPrice))}
  if(maxPrice!==null&&Number.isFinite(Number(maxPrice))){sql+=' AND f.price<=?';params.push(Number(maxPrice))}
  if(minRating!==null&&Number.isFinite(Number(minRating))){sql+=' AND COALESCE((SELECT AVG(rr.rating) FROM reviews rr WHERE rr.food_id=f.id),0)>=?';params.push(Number(minRating))}
  if(sort==='price_asc'||sort==='priceLow')sql+=' ORDER BY f.price ASC'
  else if(sort==='price_desc'||sort==='priceHigh')sql+=' ORDER BY f.price DESC'
  else if(sort==='rating')sql+=' ORDER BY avg_rating DESC,review_count DESC'
  else if(sort==='popular')sql+=' ORDER BY sold_count DESC,avg_rating DESC'
  else sql+=' ORDER BY f.id DESC'
  sql+=` LIMIT ${Math.min(Math.max(Number(limit)||50,1),100)}`
  const [rows]=await db.query(sql,params);return rows
}
async function getFoodById(id){await ready();const [rows]=await db.query(`SELECT f.*,c.name AS category_name,COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.food_id=f.id),0) AS avg_rating,COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.food_id=f.id),0) AS review_count,COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.food_id=f.id AND o.status<>'Đã hủy'),0) AS sold_count FROM foods f LEFT JOIN categories c ON c.id=f.category_id WHERE f.id=?`,[id]);return rows[0]||null}
async function searchFoodsSmart({keyword='',category='',ingredient='',minPrice=null,maxPrice=null,minRating=null,sort='newest',limit=10}={}){let foods=await getFoods({keyword,minPrice,maxPrice,minRating,sort,limit:100});if(category)foods=foods.filter(f=>normalizeText(f.category_name).includes(normalizeText(category)));if(ingredient)foods=foods.filter(f=>normalizeText(`${f.title} ${f.description} ${f.ingredients}`).includes(normalizeText(ingredient)));return foods.slice(0,Math.min(Number(limit)||10,30))}
async function getReviewsByFoodId(foodId){await ready();const [rows]=await db.query('SELECT * FROM reviews WHERE food_id=? ORDER BY created_at DESC',[foodId]);return rows}
async function addReview(foodId,username,rating,comment,image=''){await ready();await db.query('INSERT INTO reviews(food_id,username,rating,comment,image) VALUES(?,?,?,?,?)',[foodId,username,rating,comment,image])}
async function getFoodRatingSummary(foodId){await ready();const [rows]=await db.query('SELECT COUNT(*) AS reviewCount,AVG(rating) AS avgRating FROM reviews WHERE food_id=?',[foodId]);return{reviewCount:Number(rows[0]?.reviewCount||0),avgRating:Number(rows[0]?.avgRating||0)}}
async function getDeliveryCompanies(){await ready();const [rows]=await db.query('SELECT * FROM delivery_companies ORDER BY fee ASC');return rows}
async function getFoodOrderCounts(){await ready();const [rows]=await db.query("SELECT oi.food_id,SUM(oi.quantity) AS count FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'Đã hủy' GROUP BY oi.food_id");return Object.fromEntries(rows.map(r=>[r.food_id,Number(r.count||0)]))}
async function getFoodCount(){await ready();const [rows]=await db.query('SELECT COUNT(*) AS total FROM foods');return Number(rows[0]?.total||0)}
async function createFood({title,description,price,category_id,image,gram=0,ingredients='',stock=50,low_stock_threshold=5}){await ready();const [result]=await db.query('INSERT INTO foods(title,description,price,category_id,image,gram,ingredients,stock,low_stock_threshold) VALUES(?,?,?,?,?,?,?,?,?)',[title,description||'',Number(price||0),category_id||null,image||'',Number(gram||0),ingredients||'',Math.max(0,Number(stock||0)),Math.max(0,Number(low_stock_threshold||5))]);return result.insertId}
async function updateFood({id,title,description,price,category_id,image,gram=0,ingredients}){await ready();const fields=['title=?','description=?','price=?','category_id=?','image=?','gram=?'];const params=[title,description||'',Number(price||0),category_id||null,image||'',Number(gram||0)];if(ingredients!==undefined){fields.push('ingredients=?');params.push(ingredients||'')}params.push(Number(id));await db.query(`UPDATE foods SET ${fields.join(',')} WHERE id=?`,params)}
async function deleteFood(id){await ready();await db.query('DELETE FROM foods WHERE id=?',[Number(id)])}
module.exports={initFoodSchema,normalizeText,getAllCategories,addCategory,deleteCategory,getFoods,getFoodById,searchFoodsSmart,getReviewsByFoodId,addReview,getFoodRatingSummary,getDeliveryCompanies,getFoodOrderCounts,getFoodCount,createFood,updateFood,deleteFood}
