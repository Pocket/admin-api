# Client API

To get the federated schema for this service from the [Apollo Studio](https://studio.apollographql.com/), you need an API key.
You can Obtain an API key from https://engine.apollographql.com/user-settings. 

Create an environment variable named `APOLLO_KEY` and assign your API key to it before starting this service

## <a name="starting"></a> Starting the service
- Install [docker](https://www.docker.com/) and [rover cli](https://www.apollographql.com/docs/rover/getting-started) if not already configured.
- Run `npm ci` to install the project dependencies
- Run `docker-compose up` to start the memcache container. Add the `-d` option to run the container in the background
- Run `npm run start:dev` to start the application

**Note**: To use the production subgraphs locally, you must be logged into the Pocket VPN.

## Working with subgraphs (federated services) locally
- (Optional) Clone the repository of the subgraph(s) you intend to work with if you haven't already
- Start the subgraph service(s) locally, ensure that the services are fully up and running at an endpoint
- Grab the subgraph(s) endpoint(s) and update the `local-supergraph-config.yaml` file. Example:
  ```yaml
  subgraphs:
    parser:
      routing_url: http://localhost:4001
      schema:
        subgraph_url: http://localhost:4001
  ```
- Start this service using the same steps from [Starting the service](#starting) above

All requests through this gateway will now resolve to the local subgraph services.

## Gotchas
- This service uses memcache to cache query and mutation responses. If you are getting the same results when you expect something else, there's a good chance that the response is cached.
  - The easiest way to get around this is to flush the cache with `echo 'flush_all' | nc localhost 11211`
  - Restarting the memcache container also works to flush the cache

## Client API Schema/Naming Conventions

The general principles guiding these are:
* What are GraphQl's own recommendations (Looking at http://spec.graphql.org/)
* What are the industry standards or standards used by the tools we use (Such as Apollo's recommendations: https://www.apollographql.com/docs/apollo-server/schema/schema/#naming-conventions)
* What will have the best compatibility with naming conventions in languages that our primary consumers of the API (apps) will use, to reduce likelihood of them having to rename or adapt them.

### Casing

Use `PascalCase` for:
* Definition names. Such as the names of types, enums, scalars, unions etc. (except directives, see below)

Use `camelCase` for:
* Field names
* Argument names
* Query and Mutation names
* Directive names

Use `ALL_CAPS` for:
* Enum options


### Acronyms & Abbreviations

For words like URL, HTTP, HTML, etc, do not uppercase all letters, just follow casing rules above. 

Some examples:

For types:
* URL would be `Url`
* HTML would be `Html`
* ArticleHTML would be `ArticleHtml`

For fields:
* URL would be `url`
* articleURL would be `articleUrl`
* itemID would be `itemId`

For enums however, everything is already capitalized:
* URL would be `URL`
* articleURL would be `ARTICLE_URL`


