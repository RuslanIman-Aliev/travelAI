import { NestFactory } from '@nestjs/core';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { API_PREFIX } from '../src/api-prefix';
import { AppModule } from '../src/app.module';
import { createOpenApiDocument } from '../src/openapi';

const OUTPUT = resolve(__dirname, '..', 'openapi.json');

/**
 * Writes the OpenAPI document to a file.
 *
 * The application is created but never started: building the document only needs
 * the routes registered, so nothing listens on a port and no lifecycle hook runs
 * - which is why this works without a reachable database.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);

  const document = createOpenApiDocument(app);
  await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  const paths = Object.keys(document.paths).length;
  console.log(`openapi.json written (${paths} paths) -> ${OUTPUT}`);
}

void main();
