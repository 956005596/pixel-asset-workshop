#!/usr/bin/env node
/** Optional local stdio MCP server. Never registers itself or changes host settings. */
import {describe,runRequest,inspectProject,previewProject} from './cli.mjs';
const contract=await describe();
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const tools=[
 {name:'pixel_workshop_describe',description:'读取离线技能特效工具的完整调用规范、模板、稳定部件ID、参数范围和JSON请求Schema。先调用此工具，避免猜字段。',inputSchema:object({})},
 {name:'pixel_workshop_render',description:'按结构化配方生成或修改技能特效，返回预览、透明PNG图集、单帧、播放JSON、可编辑项目和配方的本地绝对路径。输出目录必须是新目录，不覆盖原件；使用projectPath继续编辑已有成果。',inputSchema:object({request:contract.requestSchema,outputDir:{type:'string',description:'可选的新输出目录；相对路径基于服务工作目录。'}},['request'])},
 {name:'pixel_workshop_inspect',description:'只读检查已保存项目，返回参数、稳定部件ID、逐帧像素边界、空帧及可能裁切提示。',inputSchema:object({projectPath:{type:'string'}},['projectPath'])},
 {name:'pixel_workshop_preview',description:'只读渲染项目的关键帧联系图，并直接返回PNG图像供模型查看。帧索引从0开始；此预览有背景和标签，不应作为透明游戏素材。',inputSchema:object({projectPath:{type:'string'},options:contract.previewSchema},['projectPath'])}
];
const active=new Map();let initialized=false,closing=false,work=Promise.resolve();
function send(message){if(!closing)process.stdout.write(JSON.stringify(message)+'\n')}
function rpcError(id,code,message){send({jsonrpc:'2.0',id,error:{code,message}})}
function argsObject(args,fields,required=[]){if(!args||typeof args!=='object'||Array.isArray(args))throw Error('参数必须是对象。');for(const k of Object.keys(args))if(!fields.includes(k))throw Error('不支持的字段：'+k);for(const k of required)if(!(k in args))throw Error('缺少参数：'+k)}
async function callTool(name,args,signal){
 if(name==='pixel_workshop_describe'){argsObject(args,[]);return {content:[{type:'text',text:JSON.stringify(contract)}],structuredContent:contract}}
 if(name==='pixel_workshop_render'){argsObject(args,['request','outputDir'],['request']);const result=await runRequest(args.request,{outputDir:args.outputDir,signal});return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}}
 if(name==='pixel_workshop_inspect'){argsObject(args,['projectPath'],['projectPath']);const result=await inspectProject(args.projectPath,{signal});return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}}
 if(name==='pixel_workshop_preview'){argsObject(args,['projectPath','options'],['projectPath']);const {preview,...info}=await previewProject(args.projectPath,args.options===undefined?{}:args.options,{signal});const result={...info,width:preview.width,height:preview.height,frames:preview.frames};return {content:[{type:'text',text:JSON.stringify(result)},{type:'image',mimeType:'image/png',data:preview.data}],structuredContent:result}}
 throw Object.assign(Error('不支持的工具。'),{code:'UNKNOWN_TOOL'});
}
async function handle(msg){
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'){rpcError(msg?.id??null,-32600,'无效的JSON-RPC请求。');return}
 const id=msg.id;
 if(id===undefined){if(msg.method==='notifications/cancelled'){active.get(msg.params?.requestId)?.abort()}return}
 if(msg.method==='initialize'){const supported=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];initialized=true;send({jsonrpc:'2.0',id,result:{protocolVersion:supported.includes(msg.params?.protocolVersion)?msg.params.protocolVersion:supported[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'pixel-asset-workshop',version:'1.0.0'},instructions:'本地确定性技能特效工具。先describe，再render，查看返回预览后调整；不联网补画，不覆盖已有输出。'}});return}
 if(msg.method==='ping'){send({jsonrpc:'2.0',id,result:{}});return}
 if(!initialized){rpcError(id,-32000,'请先initialize。');return}
 if(msg.method==='tools/list'){send({jsonrpc:'2.0',id,result:{tools}});return}
 if(msg.method!=='tools/call'){rpcError(id,-32601,'不支持的方法。');return}
 if(typeof msg.params?.name!=='string'){rpcError(id,-32602,'缺少工具名称。');return}
 if(!tools.some(t=>t.name===msg.params.name)){rpcError(id,-32602,'不支持的工具名称。');return}
 if(active.has(id)){rpcError(id,-32600,'请求ID重复。');return}
 const controller=new AbortController();active.set(id,controller);
 const task=async()=>{try{if(controller.signal.aborted)throw Object.assign(Error('调用已取消。'),{code:'CANCELLED'});const result=await callTool(msg.params.name,msg.params.arguments??{},controller.signal);send({jsonrpc:'2.0',id,result})}catch(e){const result={ok:false,error:{code:e.code??'INVALID_ARGUMENT',message:e.message,details:e.details??{}}};send({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}})}finally{active.delete(id)}};
 work=work.then(task,task);
}
process.stdin.setEncoding('utf8');let buffer='',discard=false;
process.stdin.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(discard){discard=false;continue}if(!line)continue;if(Buffer.byteLength(line)>8*1024*1024){rpcError(null,-32600,'请求行超过8 MiB。');continue}try{handle(JSON.parse(line)).catch(e=>process.stderr.write(e.message+'\n'))}catch{rpcError(null,-32700,'JSON格式无效。')}}if(Buffer.byteLength(buffer)>8*1024*1024){buffer='';discard=true;rpcError(null,-32600,'请求行超过8 MiB。')}});
function shutdown(){if(closing)return;closing=true;process.stdin.pause();process.stdin.destroy();for(const c of active.values())c.abort();work.finally(()=>{process.exitCode=0});}
process.stdin.on('end',shutdown);process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
