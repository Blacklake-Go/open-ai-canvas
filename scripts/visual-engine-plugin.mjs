import { readFile } from "node:fs/promises";
const [command, ...args] = process.argv.slice(2);
const options = Object.fromEntries(args.filter(value=>value.startsWith("--")).map(value=>{const [key,...parts]=value.slice(2).split("=");return [key,parts.join("=")||true];}));
const origin = new URL(String(options.origin || "http://127.0.0.1:18080"));
if(origin.protocol!=="https:"&&!["127.0.0.1","localhost"].includes(origin.hostname))throw Error("远程管理必须使用 HTTPS");
const allowed = ["status","health","install","activate","deactivate","update","uninstall","versions","rollback"];
if(!allowed.includes(command))throw Error("用法：node visual-engine-plugin.mjs "+allowed.join("|")+" --origin=https://站点 --session=storage-state.json [--version=版本] [--clear-config]");
let cookies="";
if(options.session){const state=JSON.parse(await readFile(String(options.session),"utf8"));cookies=(state.cookies||[]).filter(cookie=>{const domain=cookie.domain.replace(/^\\./,"");return (origin.hostname===domain||origin.hostname.endsWith("."+domain))&&(!cookie.secure||origin.protocol==="https:");}).map(cookie=>cookie.name+"="+cookie.value).join("; ");}
async function request(path,body){
 const response=await fetch(new URL(path,origin),{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(cookies?{Cookie:cookies}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:"error"});
 const value=await response.json();if(!response.ok||value.code!==0)throw Error("操作失败（HTTP "+response.status+"）："+String(value.msg||"请求被拒绝"));return value.data;
}
const admin="/api/admin/plugins/supdance-visual-engine";
if(command==="status"){const bundle=await request("/api/plugins/supdance-visual-engine/bundle");console.log(JSON.stringify({installation:bundle.installation,enabled:bundle.enabled,publishedVersion:bundle.version,schema:bundle.config.schemaVersion},null,2));}
else if(command==="health"){const bundle=await request("/api/plugins/supdance-visual-engine/bundle");const ready=await request("/api/health/ready");console.log(JSON.stringify({installation:bundle.installation,ready},null,2));}
else{
 if(!cookies)throw Error("写操作需要管理员浏览器导出的 storageState 会话文件；工具不读取密码");
 if(command==="versions"){const overview=await request(admin+"/overview");console.log(JSON.stringify(overview.snapshots.map(item=>({version:item.version,actor:item.actor,timestamp:item.timestamp,summary:item.summary})),null,2));}
 else if(command==="rollback"){if(typeof options.version!=="string")throw Error("回滚必须指定 --version");const bundle=await request("/api/plugins/supdance-visual-engine/bundle");const result=await request(admin+"/rollback",{version:options.version,expectedRevision:bundle.revision});console.log(JSON.stringify({version:result.bundle.version,enabled:result.bundle.enabled}));}
 else console.log(JSON.stringify(await request(admin+"/lifecycle",{action:command,retainConfig:!options["clear-config"]}),null,2));
}
