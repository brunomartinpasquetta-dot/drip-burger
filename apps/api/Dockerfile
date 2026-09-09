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
#
# Repos apuntados a snapshot.debian.org. Bullseye salió del soporte de
# seguridad regular: el Release file de bullseye-security venció y sus .deb
# ya no se sirven desde deb.debian.org (404 en libperl5.32, libnss3, openssl
# y una docena más), así que el build se caía con exit 100. archive.debian.org
# todavía no publicó ese suite. Las líneas de snapshot vienen comentadas en la
# imagen base y apuntan a una fecha congelada que sí tiene todo, security
# incluido — descomentarlas es más reproducible que borrar el repo y quedarse
# con las versiones de main sin parchear.
#
# Check-Valid-Until=false hace falta porque los Release de un snapshot están
# viejos por definición.
RUN sed -i \
      -e 's|^deb http://deb.debian.org|#deb http://deb.debian.org|' \
      -e 's|^# deb http://snapshot.debian.org|deb http://snapshot.debian.org|' \
      /etc/apt/sources.list \
    && apt-get -o Acquire::Check-Valid-Until=false update && apt-get install -y \
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
