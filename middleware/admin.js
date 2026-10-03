function requireAdmin(req,res,next){
  const role=req.session?.user?.role
  const isAdmin=role==='admin'||role==='super_admin'||req.session?.user?.username==='admin'
  if(!isAdmin){
    if(req.method==='POST'||req.xhr||String(req.headers?.accept||'').includes('application/json'))return res.status(403).json({error:'Forbidden',message:'Bạn không có quyền truy cập chức năng quản trị.'})
    return res.redirect('/foods')
  }
  next()
}
module.exports={requireAdmin}
