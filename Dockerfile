FROM node:16@sha256:68e34cfcd8276ad531b12b3454af5c24cd028752dfccacce4e19efef6f7cdbe0

ARG GIT_SHA

WORKDIR /usr/src/app

COPY . .

ENV NODE_ENV=production
ENV PORT 4000
ENV GIT_SHA=${GIT_SHA}
EXPOSE ${PORT}

CMD ["npm", "start"]
