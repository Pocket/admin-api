import app from './server/main';

// The `listen` method launches a web server.
app.listen({ port: 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000`)
);
