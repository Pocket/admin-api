FROM node:16@sha256:466d0a05ecb1e5b9890960592311fa10c2bc6012fc27dbfdcc74abf10fc324fc

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
