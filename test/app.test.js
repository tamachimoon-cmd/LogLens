import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogLensServer } from '../src/app.js';

async function withServer(fn){const server=createLogLensServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const {port}=server.address();try{await fn(`http://127.0.0.1:${port}`)}finally{await new Promise(r=>server.close(r))}}
test('health responde com versão',()=>withServer(async base=>{const r=await fetch(`${base}/api/health`);assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok',version:'0.1.0'})}));
test('analisa log pela API',()=>withServer(async base=>{const r=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename:'app.log',content:'2026-08-16T10:00:00Z ERROR timeout'})});const data=await r.json();assert.equal(r.status,200);assert.equal(data.summary.levels.ERROR,1);assert.match(data.report,/app.log/)}));
test('rejeita extensão não permitida',()=>withServer(async base=>{const r=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename:'secret.csv',content:'ERROR x'})});assert.equal(r.status,400)}));
