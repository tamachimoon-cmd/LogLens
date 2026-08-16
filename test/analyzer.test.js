import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLog, buildIncidentReport, extractTimestamp, normalizeLevel, normalizePattern, parseLine } from '../src/analyzer.js';

test('normaliza aliases de níveis',()=>{assert.equal(normalizeLevel('warning'),'WARN');assert.equal(normalizeLevel('critical'),'FATAL')});
test('extrai timestamp ISO',()=>assert.equal(extractTimestamp('2026-08-16T10:20:30Z ERROR x'),'2026-08-16T10:20:30.000Z'));
test('normaliza dados variáveis em padrões',()=>{const value=normalizePattern('timeout request 98231 from 10.0.0.14');assert.equal(value,'timeout request <n> from <ip>')});
test('parseia linha e separa nível e mensagem',()=>{const event=parseLine('2026-08-16T10:20:30Z ERROR database timeout',0);assert.equal(event.level,'ERROR');assert.equal(event.message,'database timeout')});
test('contabiliza níveis e padrões recorrentes',()=>{const result=analyzeLog('2026-08-16T10:00:00Z ERROR timeout 12345\n2026-08-16T10:00:10Z ERROR timeout 67890\nWARN slow');assert.equal(result.summary.totalLines,3);assert.equal(result.summary.levels.ERROR,2);assert.equal(result.patterns[0].count,2)});
test('gera timeline por minuto',()=>{const result=analyzeLog('2026-08-16T10:00:00Z INFO a\n2026-08-16T10:00:10Z ERROR b\n2026-08-16T10:01:00Z WARN c');assert.equal(result.timeline.length,2);assert.equal(result.timeline[0].errors,1)});
test('gera relatório markdown',()=>{const report=buildIncidentReport(analyzeLog('ERROR boom',{filename:'x.log'}));assert.match(report,/Relatório LogLens/);assert.match(report,/ERROR: 1/) });
test('rejeita conteúdo que não seja texto',()=>assert.throws(()=>analyzeLog(null),/deve ser texto/));
