import 'dotenv/config';
import 'reflect-metadata';
import { json } from 'express';
import rateLimit from 'express-rate-limit';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET environment variable must be set and at least 32 characters long',
    );
  }

  const hasUppercase = /[A-Z]/.test(jwtSecret);
  const hasLowercase = /[a-z]/.test(jwtSecret);
  const hasDigit = /[0-9]/.test(jwtSecret);
  const hasSpecial = /[^A-Za-z0-9]/.test(jwtSecret);
  const charDiversity = [
    hasUppercase,
    hasLowercase,
    hasDigit,
    hasSpecial,
  ].filter(Boolean).length;
  if (charDiversity < 3) {
    throw new Error(
      'JWT_SECRET must contain at least 3 of: uppercase, lowercase, digits, special characters',
    );
  }

  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '1mb' }));
  app.use(helmet());

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Robinhoot')
      .setDescription(
        'Create educational exercises and practice with your students—all in real time. Have fun!',
      )
      .setVersion('0.1')
      .addTag('robinhoot')
      .addBearerAuth()
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
