FROM node:18-alpine

# The Alpine compatibility fix
RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3004

CMD ["npm", "start"]