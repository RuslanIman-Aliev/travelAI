import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { SESSION_COOKIE_NAMES } from './auth/cookie-names';

/** Where the API answers. Only environments that exist are listed. */
const LOCAL_SERVER_URL = 'http://localhost:3001';

/**
 * Builds the OpenAPI document.
 *
 * Lives apart from `main.ts` because two things need it: the running app, which
 * serves it at `/docs`, and `npm run docs:openapi`, which writes it to a file. A
 * second copy of this configuration would drift from the first.
 *
 * @param {INestApplication} app - An application whose routes are registered.
 * @returns {OpenAPIObject} The document.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const [sessionCookie] = SESSION_COOKIE_NAMES;

  const config = new DocumentBuilder()
    .setTitle('Travel AI API')
    .setDescription(
      [
        'Server for the Travel AI web app: trips and AI-generated itineraries.',
        '',
        'This API does not issue sessions. The Next.js front end signs the user',
        'in through Auth.js, which writes the session to Postgres; every request',
        'here is authorised by looking that session up by its cookie. The bearer',
        'scheme carries the same token, for the case where the front end is',
        'served from a different site and the browser would drop the cookie.',
      ].join(' '),
    )
    .setVersion('1.0')
    .addServer(LOCAL_SERVER_URL, 'Local development')
    .addTag('health', 'Liveness probe. The only route that needs no session.')
    .addTag('auth', 'Who the current session belongs to.')
    .addTag('trips', 'Reading, renaming and deleting the caller trips.')
    .addTag('generation', 'Progress of an itinerary being generated.')
    .addCookieAuth(
      sessionCookie,
      {
        type: 'apiKey',
        in: 'cookie',
        name: sessionCookie,
        description:
          'Session cookie set by the Next.js app on sign-in. A browser sends it automatically; for a manual call, copy its value out of devtools.',
      },
      'session',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'The same session token as the cookie carries, for clients that cannot send cookies.',
      },
      'session-bearer',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}
