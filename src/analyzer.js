import { createHash } from 'node:crypto';

export const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LEVEL_RE = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i;
const TIMESTAMP_PATTERNS = [
  /^\s*(\d{4}-\d{2}-\d{2}[T ][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
  /^\s*\[?(\d{4}\/\d{2}\/\d{2}[ T][0-2]\d:[0-5]\d:[0-5]\d)\]?/,
  /^\s*\[?(\d{2}\/\d{2}\/\d{4}[ T][0-2]\d:[0-5]\d:[0-5]\d)\]?/
];

export function normalizeLevel(value) {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'WARNING') return 'WARN';
  if (upper === 'CRITICAL') return 'FATAL';
  return LEVELS.includes(upper) ? upper : 'INFO';
}

export function extractTimestamp(line) {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;
    const raw = match[1];
    const isoLike = raw.includes('/') ? raw.replace(/\//g, '-').replace(' ', 'T') : raw.replace(' ', 'T');
    const date = new Date(isoLike);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function normalizePattern(message) {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b\d{4,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLine(line, index) {
  const levelMatch = line.match(LEVEL_RE);
  const level = normalizeLevel(levelMatch?.[1] ?? 'INFO');
  const timestamp = extractTimestamp(line);
  const message = line
    .replace(TIMESTAMP_PATTERNS[0], '')
    .replace(TIMESTAMP_PATTERNS[1], '')
    .replace(TIMESTAMP_PATTERNS[2], '')
    .replace(LEVEL_RE, '')
    .replace(/^\s*[-:|\]]?\s*/, '')
    .trim() || line.trim();

  return {
    line: index + 1,
    timestamp,
    level,
    message,
    raw: line
  };
}

function minuteBucket(timestamp) {
  if (!timestamp) return null;
  return `${timestamp.slice(0, 16)}:00Z`;
}

export function analyzeLog(content, { filename = 'log.txt', patternLimit = 8 } = {}) {
  if (typeof content !== 'string') throw new TypeError('O conteúdo do log deve ser texto.');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events = lines.map(parseLine);
  const levels = Object.fromEntries(LEVELS.map((level) => [level, 0]));
  const patternMap = new Map();
  const timelineMap = new Map();
  let firstTimestamp = null;
  let lastTimestamp = null;

  for (const event of events) {
    levels[event.level] += 1;
    if (event.timestamp) {
      if (!firstTimestamp || event.timestamp < firstTimestamp) firstTimestamp = event.timestamp;
      if (!lastTimestamp || event.timestamp > lastTimestamp) lastTimestamp = event.timestamp;
      const bucket = minuteBucket(event.timestamp);
      const current = timelineMap.get(bucket) ?? { timestamp: bucket, total: 0, errors: 0, warnings: 0 };
      current.total += 1;
      if (event.level === 'ERROR' || event.level === 'FATAL') current.errors += 1;
      if (event.level === 'WARN') current.warnings += 1;
      timelineMap.set(bucket, current);
    }

    if (['WARN', 'ERROR', 'FATAL'].includes(event.level)) {
      const pattern = normalizePattern(event.message);
      const key = `${event.level}:${pattern}`;
      const current = patternMap.get(key) ?? { level: event.level, pattern, count: 0, examples: [] };
      current.count += 1;
      if (current.examples.length < 3) current.examples.push(event.message);
      patternMap.set(key, current);
    }
  }

  const patterns = [...patternMap.values()]
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern))
    .slice(0, patternLimit);
  const timeline = [...timelineMap.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const criticalCount = levels.ERROR + levels.FATAL;
  const warnCount = levels.WARN;
  const score = events.length === 0 ? 100 : Math.max(0, Math.round(100 - (criticalCount * 5 + warnCount * 2) / events.length * 10));

  return {
    id: createHash('sha256').update(`${filename}:${content}`).digest('hex').slice(0, 12),
    filename,
    analyzedAt: new Date().toISOString(),
    summary: {
      totalLines: events.length,
      timestampedLines: events.filter((event) => event.timestamp).length,
      firstTimestamp,
      lastTimestamp,
      healthScore: score,
      levels
    },
    patterns,
    timeline,
    events
  };
}

export function buildIncidentReport(analysis) {
  const { summary } = analysis;
  const top = analysis.patterns.length
    ? analysis.patterns.map((item) => `- **${item.level}** × ${item.count}: ${item.pattern}`).join('\n')
    : '- Nenhum padrão WARN/ERROR/FATAL recorrente detectado.';

  return `# Relatório LogLens — ${analysis.filename}\n\n` +
    `Gerado em: ${analysis.analyzedAt}\n\n` +
    `## Resumo\n\n` +
    `- Linhas analisadas: ${summary.totalLines}\n` +
    `- ERROR: ${summary.levels.ERROR}\n` +
    `- FATAL: ${summary.levels.FATAL}\n` +
    `- WARN: ${summary.levels.WARN}\n` +
    `- Saúde estimada: ${summary.healthScore}/100\n` +
    `- Primeiro timestamp: ${summary.firstTimestamp ?? 'não detectado'}\n` +
    `- Último timestamp: ${summary.lastTimestamp ?? 'não detectado'}\n\n` +
    `## Padrões prioritários\n\n${top}\n\n` +
    `## Observação\n\nO score é heurístico e serve para triagem, não para diagnóstico automático de causa raiz.\n`;
}
