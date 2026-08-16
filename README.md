# LogLens

**LAB//ABERTO #005** · analisador local de logs para triagem rápida de incidentes.

O LogLens recebe arquivos `.log` ou `.txt`, classifica níveis, extrai timestamps, identifica padrões recorrentes e gera um relatório de incidente. O arquivo não é persistido: o backend processa o conteúdo em memória e devolve somente a análise.

## MVP

- Upload de `.log` e `.txt` de até 2 MB.
- Detecção de `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` e `FATAL`.
- Extração de timestamps ISO e formatos comuns de servidor.
- Métricas por nível e cobertura temporal.
- Busca e filtros no navegador.
- Agrupamento de mensagens recorrentes com normalização de IDs, IPs e números.
- Linha do tempo de eventos por minuto.
- Exportação da análise em JSON.
- Relatório de incidente em Markdown.
- Interface responsiva e demonstrável.
- Testes com `node:test`, Docker e GitHub Actions.

## Requisitos

Node.js 20 ou superior.

```bash
npm start
```

Abra `http://localhost:3000`.

### Desenvolvimento

```bash
npm run dev
```

### Validação

```bash
npm run check
npm test
```

## API

### `GET /api/health`

Retorna a versão e o estado do serviço.

### `POST /api/analyze`

```json
{
  "filename": "app.log",
  "content": "2026-08-16T10:20:30Z ERROR database timeout"
}
```

O limite padrão é 2 MB por análise.

## Docker

```bash
docker compose up --build
```

## Privacidade

O LogLens não grava arquivos enviados em disco e não usa serviços de terceiros. Ainda assim, logs podem conter segredos, tokens, e-mails e dados pessoais. Remova dados sensíveis antes de usar uma instância pública.

## Roadmap

Consulte [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Independência

Projeto pessoal e independente para estudo e contribuição com a comunidade. Não contém código, processos, dados ou propriedade intelectual de empregadores ou clientes do autor.

## Licença

MIT.
