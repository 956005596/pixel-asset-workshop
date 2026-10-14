import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {Renderer} from '../cli.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-workshop-test-'));
const renderer=new Renderer();let passed=0;
function check(name,condition){assert.ok(condition,name);passed++;console.log('PASS',name);}
async function cli(args){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(root,'cli.mjs'),...args],{cwd:root});let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);
    child.on('close',code=>{try{resolve({code,data:JSON.parse(stdout),stderr});}catch{reject(Error(stdout+stderr));}});
  });
}
const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),180000);
let mcp;
try {
  await renderer.start(abort.signal);
  const capabilities=await renderer.call('describe');
  check('live effect templates and offline mode',capabilities.skills.length===5&&capabilities.offline===true);
  const contract=JSON.parse(await fs.readFile(path.join(root,'agent-contract.json'),'utf8'));
  assert.deepEqual(contract.capabilities,capabilities);check('published contract matches runtime',true);
  const character=(await renderer.call('getProject')).character;
  for(const template of capabilities.skills){
    await renderer.call('setEffect',{template:template.id,settings:{size:128,frames:12,fps:12}});
    const d=await renderer.call('inspect');
    check(`${template.id} renders nonempty frames`,d.frames.length===12&&d.frames.some(f=>!f.empty));
  }
  await renderer.call('setEffect',{template:'ice',settings:{size:256,frames:24,fps:24,seed:239438}});
  const before=await renderer.call('getProject');
  await assert.rejects(renderer.call('patchEffect',{operations:[{op:'update',id:'does-not-exist',changes:{count:2}}]}));
  assert.deepEqual(await renderer.call('getProject'),before);check('invalid edit leaves the project intact',true);
  const bundle=await renderer.call('exportBundle',{name:'smoke',columns:6,frame:12});
  check('export includes six expected file types',bundle.files.length===6&&['sheet','frame','preview','project','playback','recipe'].every(kind=>bundle.files.some(f=>f.kind===kind)));
  check('playback dimensions and frame order',bundle.metadata.sheetWidth===1536&&bundle.metadata.sheetHeight===1024&&bundle.metadata.frames[12].x===0&&bundle.metadata.frames[12].y===512);
  const sheet=bundle.files.find(f=>f.kind==='sheet');
  const pngCheck=await renderer.evaluate(`(async()=>{const img=new Image();img.src='data:image/png;base64,${sheet.data}';await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let clear=false,visible=false;for(let i=3;i<d.length;i+=4){clear ||= d[i]===0;visible ||= d[i]>0}const cell=ctx.getImageData(0,512,256,256).data;const frame=fxCanvases[12].getContext('2d').getImageData(0,0,256,256).data;return {clear,visible,matching:cell.every((v,i)=>v===frame[i])}})()`);
  check('PNG keeps transparency and exact rendered frame pixels',pngCheck.clear&&pngCheck.visible&&pngCheck.matching);
  await renderer.call('setEffect',{template:'fire'});
  await renderer.call('loadProject',{project:before});
  assert.deepEqual(await renderer.call('getProject'),before);check('editable project round trip is lossless',true);
  assert.deepEqual(before.character,character);check('effect edits preserve character data',true);
  const rigCheck=await renderer.evaluate(`(()=>{const n=64,a=blank(n);for(const p of defaultRigParts(n)){const b=p.rect;for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)a[y*n+x]=0x54bcffff}const r=newRig(a,'synthetic',64,64,64);r.frames=12;r.action='run';r.facing='right';const poses=Array.from({length:12},(_,k)=>skeletonPose(r,k));const seq=buildRigSequence(r,64);const skeleton=JSON.parse(JSON.stringify(r.skeleton));const p=fresh(64,'synthetic');p.character.rig=r;const restored=validateRig(projectData(p).character.rig);return {joints:Object.keys(r.skeleton.joints).length,frames:seq.frames.length,alternating:poses.some(p=>p.contacts.left&&!p.contacts.right)&&poses.some(p=>p.contacts.right&&!p.contacts.left),version:projectData(p).version,preserved:JSON.stringify(restored.skeleton)===JSON.stringify(skeleton)}})()`);
  check('synthetic rig has 17 joints, alternating contacts and version-6 restore',rigCheck.joints===17&&rigCheck.frames===12&&rigCheck.alternating&&rigCheck.version===6&&rigCheck.preserved);
  check('isolated renderer has no external requests or console errors',renderer.health().externalRequests===0&&renderer.health().consoleErrors===0);
  await renderer.close();

  const result=await cli(['run','--request','examples/ice-burst.json','--out',path.join(temp,'demo')]);
  check('documented CLI command generates all deliverables',result.code===0&&result.data.ok&&result.data.files.length===6&&result.stderr==='');
  const original=await fs.readFile(result.data.projectPath);
  const repeat=await cli(['run','--request','examples/ice-burst.json','--out',path.join(temp,'demo')]);
  check('existing output is rejected without modifying input',repeat.code!==0&&repeat.data.error.code==='OUTPUT_EXISTS'&&original.equals(await fs.readFile(result.data.projectPath)));
  const inspect=await cli(['inspect','--project',result.data.projectPath]);
  check('CLI restores and inspects exported project',inspect.code===0&&inspect.data.diagnostics.frames.length===24);

  mcp=spawn(process.execPath,[path.join(root,'mcp-server.mjs')],{cwd:root});
  const pending=new Map();let buffer='',id=0;
  mcp.stdout.on('data',d=>{buffer+=d;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);const msg=JSON.parse(line);const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}});
  mcp.on('error',e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(e);}pending.clear();});
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('MCP timeout: '+method));},60000);pending.set(requestId,{resolve,reject,timer});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})+'\n');});
  const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'smoke-test',version:'1.0'}});
  mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const list=await rpc('tools/list');
  check('MCP handshake exposes the four documented tools',init.serverInfo.name==='pixel-asset-workshop'&&list.tools.length===4);
  const bad=await rpc('tools/call',{name:'pixel_workshop_inspect',arguments:{unexpected:true}});
  check('MCP invalid arguments return a tool error',bad.isError===true);
  const req=JSON.parse(await fs.readFile(path.join(root,'examples/ice-burst.json'),'utf8'));
  const generated=await rpc('tools/call',{name:'pixel_workshop_render',arguments:{request:req,outputDir:path.join(temp,'mcp')}});
  check('MCP really renders a local export',!generated.isError&&generated.structuredContent.ok&&generated.structuredContent.files.length===6);
  mcp.stdin.end();
  console.log(`\n${passed} checks passed. These verify mechanisms, not final artistic quality.`);
} finally {
  clearTimeout(timeout);abort.abort();mcp?.kill();await renderer.close();
  await fs.rm(temp,{recursive:true,force:true});
}
