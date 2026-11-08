FROM node:20-alpine
# Installing libvips-dev for sharp Compatibility and postgresql-client for pg_dump
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev nasm bash vips-dev postgresql-client
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/
COPY package.json package-lock.json ./
RUN npm ci || npm install
ENV PATH /opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY . .
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
