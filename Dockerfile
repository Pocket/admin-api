FROM node:16@sha256:2258e19bdee0071ed729650d0c423dd80d2a2510300585428ebfd4c2495d0f8c

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
