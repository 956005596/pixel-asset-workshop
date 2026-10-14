import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-workshop-syntax-'));
try {
  let scripts=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(/\bsrc\s*=/.test(match[1]))throw Error('The standalone editor must not load external scripts');
    const filename=path.join(temp,`inline-${scripts++}.js`);
    await fs.writeFile(filename,match[2]);execFileSync(process.execPath,['--check',filename]);
  }
  if(!scripts)throw Error('No application script found');
  for(const dir of ['.','scripts','tests'])for(const entry of await fs.readdir(path.join(root,dir))) {
    if(entry.endsWith('.mjs'))execFileSync(process.execPath,['--check',path.join(root,dir,entry)]);
  }
  for(const filename of ['package.json','agent-contract.json','examples/ice-burst.json'])JSON.parse(await fs.readFile(path.join(root,filename),'utf8'));
  if(/(?:src|href)\s*=\s*["']https?:/i.test(html))throw Error('Editor has an external resource');
  console.log(`PASS: ${scripts} inline script(s), Node syntax, JSON and standalone resources`);
} finally {await fs.rm(temp,{recursive:true,force:true});}
