FROM node:16@sha256:bf1609ac718dda03940e2be4deae1704fb77cd6de2bed8bf91d4bbbc9e88b497

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
