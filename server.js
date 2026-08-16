import { createLogLensServer } from './src/app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const server = createLogLensServer();

server.listen(port, host, () => {
  console.log(`LogLens disponível em http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando LogLens.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
