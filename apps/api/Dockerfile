FROM node:20-slim
RUN apt-get update && apt-get install -y \
    chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Carpeta donde whatsapp-web.js/LocalAuth persiste la sesión.
# En producción la montamos sobre un volumen nombrado (drip-wa-session)
# así sobrevive a restarts y rebuilds.
RUN mkdir -p /app/wa-session
EXPOSE 3002
CMD ["node", "src/main.js"]
