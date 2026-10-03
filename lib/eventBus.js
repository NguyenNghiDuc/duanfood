const {EventEmitter}=require('events')
const bus=new EventEmitter()
bus.setMaxListeners(1000)
function channel(user){return `user:${String(user||'')}`}
function emitUser(user,type,payload={}){bus.emit(channel(user),{type,payload,time:Date.now()})}
function subscribeUser(user,handler){const key=channel(user);bus.on(key,handler);return()=>bus.off(key,handler)}
module.exports={bus,emitUser,subscribeUser}
