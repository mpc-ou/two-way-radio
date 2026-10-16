import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, readFileSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { readConfig } from './config/config.js';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const tlsEnabled = Boolean(config.tls.certPath);
  if (tlsEnabled && (!existsSync(config.tls.certPath) || !existsSync(config.tls.keyPath))) {
    throw new Error('Configured TLS certificate or key file does not exist.');
  }
  const app = await NestFactory.create(AppModule, {
    cors: { origin: true, credentials: true },
    ...(tlsEnabled
      ? {
          httpsOptions: {
            cert: readFileSync(config.tls.certPath),
            key: readFileSync(config.tls.keyPath)
          }
        }
      : {})
  });
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  new Logger('Bootstrap').log(
    `Control/signaling listening at ${tlsEnabled ? 'https' : 'http'}://${config.host}:${config.port} (Single-Port Gateway via Vite Proxy)`
  );
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exitCode = 1;
});

