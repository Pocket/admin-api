FROM node:16@sha256:69badeb8c8526d1e8005b51a63080c0509e7b3849cc41b1252125c2819b3d079

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
