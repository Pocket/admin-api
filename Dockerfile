FROM node:16@sha256:ffe804d6fcced29bcfc3477de079d03a9c2b0e4917e44bfeafb1a6b0f875e383

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
