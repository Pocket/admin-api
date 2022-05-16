FROM node:16@sha256:1817bb941c9a30fe2a6d75ff8675a8f6def408efe3d3ff43dbb006e2b534fa14

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
