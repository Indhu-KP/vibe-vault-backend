"use strict";(()=>{var e={};e.id=829,e.ids=[829],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8678:e=>{e.exports=import("pg")},8756:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>d,patchFetch:()=>E,requestAsyncStorage:()=>T,routeModule:()=>c,serverHooks:()=>p,staticGenerationAsyncStorage:()=>l});var n=r(9303),i=r(8716),s=r(670),o=r(4563),u=e([o]);o=(u.then?(await u)():u)[0];let c=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/health/route",pathname:"/api/health",filename:"route",bundlePath:"app/api/health/route"},resolvedPagePath:"C:\\Users\\FixAccount\\New folder\\vibe-vault-backend\\app\\api\\health\\route.js",nextConfigOutput:"",userland:o}),{requestAsyncStorage:T,staticGenerationAsyncStorage:l,serverHooks:p}=c,d="/api/health/route";function E(){return(0,s.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},4563:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>o});var n=r(7070),i=r(4191),s=e([i]);async function o(){return await (0,i.xN)()?n.NextResponse.json({ok:!0}):n.NextResponse.json({ok:!1,error:(0,i.cK)()||"Database initialization failed"},{status:500})}i=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})},4191:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Vn:()=>u,WR:()=>E,cK:()=>T,pm:()=>c,xN:()=>o});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let l=null,p=null;function s(){if(!l){let e=process.env.SUPABASE_POOLER_URL||process.env.SUPABASE_DB_URL||process.env.DATABASE_URL;if(!e)throw Error("Missing required environment variable: SUPABASE_POOLER_URL, SUPABASE_DB_URL, or DATABASE_URL");(l=new n.Pool({connectionString:e,ssl:{rejectUnauthorized:!1},connectionTimeoutMillis:1e4,idleTimeoutMillis:3e4,max:10})).on("error",e=>{console.error("Unexpected pool error:",e),l=null})}return l}async function o(){try{let e=s();return await e.query("SELECT 1"),await e.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        title_hash TEXT NOT NULL,
        title_salt TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `),await e.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `),await e.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sentiment_score DOUBLE PRECISION,
        user_id TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `),console.log("✅ Connected to Supabase PostgreSQL"),!0}catch(e){return p=e.message,console.error("❌ Database initialization failed:",e.message),!1}}async function u(e,t=[]){let r=s(),a=await r.query(e,t);return{id:a.rows[0]?.id??null,changes:a.rowCount}}async function E(e,t=[]){let r=s();return(await r.query(e,t)).rows}async function c(e,t=[]){let r=s();return(await r.query(e,t)).rows[0]||null}function T(){return p}a()}catch(e){a(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[276,972],()=>r(8756));module.exports=a})();