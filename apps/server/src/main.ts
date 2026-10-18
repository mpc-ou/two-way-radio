import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { readConfig } from './config/config.js';

interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
  sendFile(path: string): void;
}

/** Các đường dẫn do server xử lý; mọi GET còn lại trả về SPA. */
const API_PREFIXES = ['/health', '/socket.io'];

function lanUrls(protocol: string, port: number): string[] {
  const suffix = (protocol === 'https' && port === 443) || (protocol === 'http' && port === 80) ? '' : `:${port}`;
  return Object.values(networkInterfaces())
    .flatMap((addrs) => addrs ?? [])
    .filter((addr) => addr.family === 'IPv4' && !addr.internal)
    .map((addr) => `${protocol}://${addr.address}${suffix}`);
}

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const logger = new Logger('Bootstrap');
  const tlsEnabled = Boolean(config.tls.certPath);
  if (tlsEnabled && (!existsSync(config.tls.certPath) || !existsSync(config.tls.keyPath))) {
    throw new Error('Configured TLS certificate or key file does not exist.');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
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

  // FE (apps/web/dist) được phục vụ từ chính tiến trình này: một cổng cho web, Socket.IO và health.
  const indexHtml = join(config.webDistPath, 'index.html');
  app.useStaticAssets(config.webDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      // Asset có hash trong tên: cache lâu; còn lại (manifest, icon) luôn kiểm tra lại.
      res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
  });
  app.use((req: HttpRequest, res: HttpResponse, next: () => void) => {
    const accept = String(req.headers.accept ?? '');
    if (req.method !== 'GET' || API_PREFIXES.some((prefix) => req.path.startsWith(prefix)) || !accept.includes('text/html')) {
      next();
      return;
    }
    if (!existsSync(indexHtml)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  const protocol = tlsEnabled ? 'https' : 'http';
  logger.log(`MPC VoiceLink listening on ${protocol}://${config.host}:${config.port} (web + Socket.IO + health)`);
  for (const url of lanUrls(protocol, config.port)) logger.log(`  Mở trên điện thoại: ${url}`);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exitCode = 1;
});
