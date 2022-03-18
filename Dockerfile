FROM node:16@sha256:c703acb3d85c1f42340c43ccac0ad32d3dd4d84ac0d7aa3b555f093b2ef2dbf9

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
