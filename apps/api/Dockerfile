FROM node:20-bullseye-slim
# bullseye (Debian 11) trae Chromium estable en apt. bookworm (Debian 12)
# empezó a servir Chromium 150.x que crashea con SIGTRAP (EXIT=133) en el
# kernel del container. Nos quedamos con bullseye y pineamos la versión
# exacta para que si Debian empuja una actualización que la rompe, el
# rebuild siga fijado en la versión probada.
#
# CHROMIUM_VERSION: si en el futuro esta versión sale del repo bullseye,
# actualizar a la más nueva disponible. Ver: apt-cache madison chromium
ARG CHROMIUM_VERSION=120.0.6099.224-1~deb11u1
RUN apt-get update && apt-get install -y \
    chromium=${CHROMIUM_VERSION} \
    && apt-mark hold chromium \
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
