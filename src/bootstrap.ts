import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/errors/http-exception.filter.js';

/**
 * Shared app configuration (pipes, filter, CORS, Swagger, /openapi.json).
 * Used by `src/main.ts` (canonical NestJS entrypoint — also what Vercel's
 * zero-config NestJS detection looks for) and by the e2e suite via createApp().
 */
export function configureApp(app: INestApplication): OpenAPIObject {
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Normalise class-validator output into one clear message; the
      // global filter then wraps it as { error: { code: 'VALIDATION_ERROR'.. } }.
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          e.constraints ? Object.values(e.constraints) : ['Invalid request.'],
        );
        const nested = errors.flatMap((e) =>
          (e.children ?? []).flatMap((c) =>
            c.constraints ? Object.values(c.constraints) : [],
          ),
        );
        const all = [...messages, ...nested].filter(Boolean);
        return new BadRequestException(
          all.length > 0 ? all.join('; ') : 'Invalid request.',
        );
      },
    }),
  );

  app.enableCors({ origin: '*' });

  const config = new DocumentBuilder()
    .setTitle('Appointment Booking API')
    .setDescription(
      'Challenge API: list fixed slots, book one active booking per slot ' +
        '(race-safe), cancel idempotently. No auth on any route. ' +
        'Realtime updates are Socket.IO events (see README) — not HTTP operations.',
    )
    .setVersion('1.0.0')
    .addTag('Slots', 'List available appointment slots')
    .addTag('Bookings', 'Create and cancel bookings')
    .addTag('Health', 'Liveness probe (extra, not in spec)')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controller, method) => method,
  });

  // Swagger UI at /docs…
  //
  // NOTE on serverless (Vercel): swagger-ui-express serves its JS/CSS from
  // node_modules, which the function bundler does not always include, leaving
  // a blank page (HTML loads, assets 404). Loading the UI shell from a pinned
  // CDN avoids that entirely; the spec JSON itself is still served locally
  // from /docs-json by this same server. Override via SWAGGER_UI_CDN if needed.
  const swaggerCdn =
    process.env.SWAGGER_UI_CDN ??
    'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.0';
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Booking API — Docs',
    customCssUrl: `${swaggerCdn}/swagger-ui.css`,
    customfavIcon: `${swaggerCdn}/favicon-32x32.png`,
    customJs: [
      `${swaggerCdn}/swagger-ui-bundle.js`,
      `${swaggerCdn}/swagger-ui-standalone-preset.js`,
    ],
    swaggerOptions: { persistAuthorization: false, tryItOutEnabled: true },
  });

  // …and the raw OpenAPI JSON at /openapi.json (spec requirement).
  const adapter = app.getHttpAdapter();
  adapter.get('/openapi.json', (_req: unknown, res: any) => res.json(document));

  return document;
}

export async function createApp(): Promise<{
  app: INestApplication;
  document: OpenAPIObject;
}> {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const document = configureApp(app);
  return { app, document };
}

export async function bootstrap(): Promise<INestApplication> {
  const { app } = await createApp();
  return app;
}
