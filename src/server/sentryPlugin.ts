import { ApolloServerPlugin } from '@apollo/server';
import * as Sentry from '@sentry/node';

/**
 * Reports GraphQL errors to Sentry. Ported from @pocket-tools/apollo-utils 2.x,
 * which depends on Apollo Server 3.
 */
export const sentryPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors(ctx) {
        if (!ctx.operation) {
          return;
        }
        for (const err of ctx.errors) {
          Sentry.withScope((scope) => {
            scope.setTag('kind', ctx.operation.operation);
            scope.setExtra('query', ctx.request.query);
            scope.setExtra('variables', JSON.stringify(ctx.request.variables));
            if (err.path) {
              scope.addBreadcrumb({
                category: 'query-path',
                message: err.path.join(' > '),
                level: 'debug',
              });
            }
            console.log(err);
            Sentry.captureException(err);
          });
        }
      },
    };
  },
};
