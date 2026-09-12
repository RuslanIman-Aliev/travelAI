import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { API_PREFIX } from './api-prefix';
import { createOpenApiDocument } from './openapi';

function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'Travel AI API',
    swaggerOptions: {
      // Survives a page reload, so a token is pasted once per session rather
      // than once per experiment.
      persistAuthorization: true,
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN'),
    credentials: true,
  });

  setupSwagger(app);

  await app.listen(config.get<number>('API_PORT') ?? 3001);
}
void bootstrap();
