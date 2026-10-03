require('dotenv').config()
const db=require('../config/db')
const {runMigrations}=require('../lib/migrationRunner')
;(async()=>{try{await db.ready();const ran=await runMigrations();console.log(ran.length?`Applied migrations: ${ran.join(', ')}`:'Database is up to date');await db.close()}catch(e){console.error(e);process.exitCode=1}})()
