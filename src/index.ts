import 'reflect-metadata';
import fastify, { FastifyRequest, FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import mercurius, { MercuriusError } from 'mercurius';
import MercuriusGQLUpload from 'mercurius-upload';
import MercuriusCache from 'mercurius-cache';
import { NoSchemaIntrospectionCustomRule } from 'graphql';
// import fastifyWebsocket from '@fastify/websocket';

import './config';

import trace from './trace';
import tracking from './tracking';
import auth from './auth';
import compatibility from './compatibility';
import routes from './routes';
import { Context } from './Context';
import { schema } from './graphql';
import createOrGetConnection from './db';
import { stringifyHealthCheck } from './common';
import { GraphQLError } from 'graphql';
import cookie, { FastifyCookieOptions } from '@fastify/cookie';
import { getSubscriptionSettings } from './subscription';
import { ioRedisPool } from './redis';

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

const userExtendKey = (
  source: unknown,
  args: unknown,
  ctx: Context,
): string | undefined => (ctx.userId ? `user:${ctx.userId}` : undefined);

const trackingExtendKey = (
  source: unknown,
  args: unknown,
  ctx: Context,
): string | undefined =>
  ctx.trackingId ? `tracking:${ctx.trackingId}` : undefined;

// readiness probe is set failureThreshold: 2, periodSeconds: 2 (4s) + small delay
const GRACEFUL_DELAY = 2 * 2 * 1000 + 3000;

export default async function app(
  contextFn?: (request: FastifyRequest) => Context,
): Promise<FastifyInstance> {
  let isTerminating = false;
  const isProd = process.env.NODE_ENV === 'production';
  const connection = await createOrGetConnection();

  const app = fastify({
    logger: true,
    disableRequestLogging: true,
    trustProxy: true,
  });

  const gracefulShutdown = () => {
    app.log.info('starting termination');
    isTerminating = true;
    setTimeout(async () => {
      await app.close();
      await connection.destroy();
      await ioRedisPool.end();
      process.exit();
    }, GRACEFUL_DELAY);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  app.register(helmet);
  app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? /daily\.dev$/ : true,
    credentials: true,
  });
  app.register(cookie, {
    secret: process.env.COOKIES_KEY,
  }) as FastifyCookieOptions;
  app.register(trace, { enabled: isProd });
  app.register(auth, { secret: process.env.ACCESS_SECRET });
  app.register(tracking);

  app.setErrorHandler((err, req, res) => {
    req.log.error({ err }, err.message);
    res.code(500).send({ statusCode: 500, error: 'Internal Server Error' });
  });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    if (isTerminating) {
      res.status(500).send(stringifyHealthCheck({ status: 'terminating' }));
    } else {
      res.send(stringifyHealthCheck({ status: 'ok' }));
    }
  });

  app.get('/liveness', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  // app.register(fastifyWebsocket, {
  //   options: {
  //     maxPayload: 1048576,
  //     verifyClient: (info, next) => next(true),
  //   },
  // });

  app.register(MercuriusGQLUpload, {
    maxFileSize: 1024 * 1024 * 2,
    maxFiles: 1,
  });

  app.register(mercurius, {
    schema,
    context:
      contextFn ?? ((request): Context => new Context(request, connection)),
    queryDepth: 10,
    subscription: getSubscriptionSettings(connection),
    // Disable GraphQL introspection in production
    graphiql: !isProd,
    validationRules: isProd && [NoSchemaIntrospectionCustomRule],
    errorFormatter(execution) {
      if (execution.errors?.length > 0) {
        const flatErrors = execution.errors.flatMap<GraphQLError>((error) => {
          if (error.originalError.name === 'FastifyError') {
            return (
              (error.originalError as MercuriusError<GraphQLError>).errors ||
              error
            );
          }
          return error;
        });
        return {
          statusCode: 200,
          response: {
            data: execution.data,
            errors: flatErrors.map((error): GraphQLError => {
              const newError = error as Mutable<GraphQLError>;
              if (!error.originalError) {
                newError.extensions = {
                  code: 'GRAPHQL_VALIDATION_FAILED',
                };
              } else if (error.originalError?.name === 'EntityNotFoundError') {
                newError.message = 'Entity not found';
                newError.extensions = {
                  code: 'NOT_FOUND',
                };
              }
              if (isProd) {
                newError.originalError = undefined;
              }
              return newError;
            }),
          },
        };
      }
      return {
        statusCode: 200,
        response: execution,
      };
    },
  });

  if (isProd) {
    app.register(MercuriusCache, {
      ttl: 10,
      policy: {
        Query: {
          searchBookmarksSuggestions: {
            extendKey: userExtendKey,
          },
          searchBookmarks: {
            extendKey: userExtendKey,
          },
          // anonymousFeed: {
          //   extendKey: userExtendKey,
          // },
          // feed: {
          //   extendKey: userExtendKey,
          // },
          sourceFeed: {
            extendKey: userExtendKey,
          },
          tagFeed: {
            extendKey: userExtendKey,
          },
          keywordFeed: {
            extendKey: userExtendKey,
          },
          searchPostSuggestions: {
            extendKey: userExtendKey,
          },
          searchPosts: {
            extendKey: userExtendKey,
          },
          authorFeed: {
            extendKey: userExtendKey,
          },
          mostUpvotedFeed: {
            extendKey: userExtendKey,
          },
          mostDiscussedFeed: {
            extendKey: userExtendKey,
          },
          randomTrendingPosts: {
            extendKey: userExtendKey,
          },
          randomSimilarPosts: {
            extendKey: userExtendKey,
          },
          randomSimilarPostsByTags: {
            extendKey: userExtendKey,
          },
          randomDiscussedPosts: {
            extendKey: userExtendKey,
          },
          tagsCategories: true,
          advancedSettings: {
            extendKey: trackingExtendKey,
          },
          banner: true,
          postByUrl: {
            extendKey: userExtendKey,
          },
          post: {
            extendKey: userExtendKey,
          },
          postUpvotes: true,
          sources: true,
          source: true,
          searchTags: true,
          userReadingRankHistory: true,
          userReadHistory: true,
        },
      },
    });
  }

  app.register(compatibility, { prefix: '/v1' });
  app.register(routes, { prefix: '/' });

  return app;
}
