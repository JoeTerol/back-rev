import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { configureApp } from './configure-app';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(Number(config.get('PORT')));
}
void bootstrap();
