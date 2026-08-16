import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLog, buildIncidentReport } from './analyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const MAX_BODY = 2 * 1024 * 1024 + 32 * 1024;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Arquivo excede o limite de 2 MB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('JSON inválido.'); }
}

async function staticFile(urlPath, response) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = path.join(publicDir, normalized);
  if (!file.startsWith(publicDir)) return false;
  try {
    const data = await fs.readFile(file);
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    response.end(data);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function createLogLensServer({ analyzer = analyzeLog } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json(response, 200, { status: 'ok', version: '0.1.0' });
      }
      if (request.method === 'POST' && url.pathname === '/api/analyze') {
        const body = await readJson(request);
        if (typeof body.content !== 'string' || !body.content.trim()) throw new Error('Envie um log não vazio.');
        const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim().slice(0, 160) : 'log.txt';
        if (!/\.(log|txt)$/i.test(filename)) throw new Error('Apenas arquivos .log e .txt são aceitos.');
        const analysis = analyzer(body.content, { filename });
        return json(response, 200, { ...analysis, report: buildIncidentReport(analysis) });
      }
      if ((request.method === 'GET' || request.method === 'HEAD') && await staticFile(url.pathname, response)) return;
      return json(response, 404, { error: 'Rota não encontrada.' });
    } catch (error) {
      return json(response, 400, { error: error.message || 'Falha inesperada.' });
    }
  });
}
