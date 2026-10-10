import 'dotenv/config';
import { parseAppEnvironment } from './config/environment';
import { createDataSource } from './database/create-data-source';
import { composeApplication } from './composition-root';

async function main(): Promise<void> {
  // Falha antes da conexão ou da abertura da porta se a configuração estiver incompleta.
  const config = parseAppEnvironment(process.env);
  const dataSource = createDataSource(config);
  await dataSource.initialize();
  const app = composeApplication(dataSource, config);
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log('MedClinic API disponível na porta ' + config.PORT + '.');
  });
  server.on('error', (error) => {
    console.error('Falha ao iniciar o servidor:', error.message);
    void dataSource.destroy().finally(() => {
      process.exitCode = 1;
    });
  });

  const shutdown = (): void => {
    server.close(() => {
      void dataSource.destroy().catch((error: unknown) => {
        console.error(
          'Falha ao encerrar a conexão:',
          error instanceof Error ? error.message : 'Erro inesperado',
        );
        process.exitCode = 1;
      });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha inesperada na inicialização.');
  process.exitCode = 1;
});
