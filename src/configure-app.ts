import { INestApplication } from '@nestjs/common';

export const configureApp = (app: INestApplication): void => {
  app.setGlobalPrefix('api');
};
