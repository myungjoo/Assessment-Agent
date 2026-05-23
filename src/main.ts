import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Application entry. For T-0001 this only proves that the bootstrap path
 * compiles and the module wiring is sound; no HTTP routes are exposed yet.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.close();
}

// Only auto-run when invoked directly (not when imported by tests).
if (require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('bootstrap failed', err);
    process.exit(1);
  });
}
