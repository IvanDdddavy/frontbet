FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_USE_MOCKS=false
ARG VITE_WS_URL=""
ARG VITE_STREAM_URL=""

ENV VITE_USE_MOCKS=$VITE_USE_MOCKS
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_STREAM_URL=$VITE_STREAM_URL

COPY package.json ./
RUN npm install

COPY . .
RUN npx msw init public/ --save
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
