import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { configureApp } from './configure-app';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './setup-swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  configureApp(app);
  const config = app.get(ConfigService);
  if (config.get('NODE_ENV') !== 'production') {
    setupSwagger(app);
  }
  await app.listen(Number(config.get('PORT')));
}
void bootstrap();
