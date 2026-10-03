const fs=require('fs/promises')
const path=require('path')
const cloud=require('../lib/cloudStorage')

function cloudUpload(folder='mini-food'){
  return async(req,res,next)=>{
    if(!req.file)return next()
    try{
      const localUrl=`/uploads/${req.file.filename}`
      if(!cloud.configured()){req.file.publicUrl=localUrl;return next()}
      const result=await cloud.uploadLocalFile(req.file.path,folder)
      req.file.publicUrl=result?.url||localUrl
      req.file.cloudPublicId=result?.publicId||''
      await fs.unlink(req.file.path).catch(()=>{})
      next()
    }catch(e){next(e)}
  }
}
module.exports={cloudUpload}
