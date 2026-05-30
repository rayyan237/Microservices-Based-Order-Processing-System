FROM node:18-alpine

# The Magic Fix: Add glibc compatibility for MongoDB native bindings
RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]