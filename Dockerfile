FROM node:19-alpine as development

WORKDIR /usr/src/app

ENV NODE_ENV=development

# node:19-alpine throw `ps: not found` if using nestjs watch mode, so install this stuff will help us resolve this error 
# RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

COPY package*.json yarn.lock ./

RUN yarn add glob rimraf

RUN yarn

COPY . .

RUN yarn build

CMD [ "yarn", "start:dev" ]

FROM node:19-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json yarn.lock ./

RUN yarn install --production --frozen-lockfile

COPY . .

COPY --from=development /usr/src/app/dist ./dist

CMD [ "node", "dist/main" ]