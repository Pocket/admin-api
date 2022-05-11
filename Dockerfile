FROM node:16@sha256:e38c052a64b1ee35b554a1d582639bf8f523b89dfae1d479bba5e1b8f184fbe1

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
