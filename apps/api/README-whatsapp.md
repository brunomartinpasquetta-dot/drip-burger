# Integración WhatsApp — apps/api

El API del dashboard usa **whatsapp-web.js** (ex-Twilio) para enviar avisos
al cliente cuando el pedido pasa a "En camino" desde el panel admin.

## Cómo funciona

- Al arrancar el API, un cliente de WhatsApp Web se inicializa en background.
- La sesión se persiste en `apps/api/wa-session/` (carpeta `LocalAuth` de
  whatsapp-web.js). En reinicios posteriores no se pide QR de nuevo mientras
  la sesión siga vigente en WhatsApp.
- El endpoint `POST /orders/send-whatsapp` chequea si el cliente está `ready`
  antes de enviar. Si no lo está (primer boot sin QR escaneado, o sesión
  inválida), responde con `messageSent: false` y el frontend muestra un
  warning pero igual marca el pedido como "En camino".

## Primer arranque (una sola vez)

1. Asegurate de tener el **celular del negocio** a mano, con WhatsApp abierto.
2. Arrancá el API:

   ```bash
   cd apps/api
   npm start
   # o en dev:
   npm run dev
   ```

3. En stdout vas a ver un código QR grande dibujado con ASCII + un mensaje:

   ```
   [INFO] WhatsApp QR recibido — escaneá con el celular del negocio:
   ```

4. En el celular: **WhatsApp → Configuración → Dispositivos vinculados →
   Vincular un dispositivo** → escaneá el QR impreso en la terminal.

5. Cuando termine el vínculo vas a ver:

   ```
   [INFO] WhatsApp autenticación OK — sesión persistida
   [INFO] WhatsApp client listo y autenticado
   ```

6. A partir de ahora el endpoint `/orders/send-whatsapp` enviará avisos
   reales. Podés testear con curl:

   ```bash
   curl -X POST http://localhost:3002/orders/send-whatsapp \
     -H "Content-Type: application/json" \
     -d '{"orderId":"test","customerPhone":"+5493425123456","customerName":"Bruno","deliveryTimeSlot":"21:00"}'
   ```

## Restart sin QR

En los reinicios siguientes del API **no** se pide QR nuevo. La sesión vive
en `apps/api/wa-session/` y se levanta automáticamente. Solo vas a ver:

```
[INFO] WhatsApp client listo y autenticado
```

## Re-vincular / resetear la sesión

Si pasa alguna de estas cosas:

- Te desvinculaste el dispositivo desde el celular
- El cliente arranca pero no pasa a "ready"
- Cambiaste el celular del negocio
- Los mensajes fallan con errores de auth

Tenés que forzar un re-vínculo:

```bash
# 1. Detené el API (Ctrl+C)
# 2. Borrá la sesión persistida
rm -rf apps/api/wa-session/

# 3. (Opcional) Limpiá el cache de puppeteer/wwebjs
rm -rf apps/api/.wwebjs_cache/

# 4. Volvé a arrancar el API
cd apps/api && npm start

# 5. Escaneá el QR nuevo
```

## Formato de teléfono

El helper `normalizePhone()` en `src/services/whatsappService.js` acepta
varios formatos AR comunes y los convierte a `549{area}{numero}`
(formato internacional que espera WhatsApp):

| Input                     | Output          |
|---------------------------|-----------------|
| `+54 9 342 512 3456`      | `5493425123456` |
| `03425-123456`            | `5493425123456` |
| `342 15 512 3456`         | `5493425123456` |
| `3425123456`              | `5493425123456` |

Si el número del cliente viene en otro formato, podés probar el helper
directo en un REPL o agregarle más casos de normalización.

## Logs útiles

El API loggea cada intento de envío con el `orderId` y el número normalizado
(sin exponer el texto del mensaje). Para ver los logs:

```bash
# En foreground el logger escribe a stdout
npm start
```

Niveles que vas a ver:

- `WhatsApp QR recibido` → esperando que escanees
- `WhatsApp autenticación OK` → QR escaneado
- `WhatsApp client listo y autenticado` → listo para enviar
- `WhatsApp enviado OK — order X` → envío exitoso
- `WhatsApp no inicializado — skip para order X` → endpoint se llamó pero el cliente aún no está ready
- `WhatsApp send failed for order X` → error de envío (número inválido, no existe en WA, etc.)
- `WhatsApp desconectado: ...` → se perdió la sesión, se reintenta en 5s

## Troubleshooting

**"Error: Failed to launch the browser process"**
Puppeteer no pudo arrancar Chromium. En Linux/macOS suele ser por deps del
sistema. Verificá:

```bash
# macOS: suele venir instalado
# Linux (debian/ubuntu):
sudo apt install -y chromium-browser libatk-bridge2.0-0 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libxkbfile1
```

**"Protocol error: Session closed"**
Suele pasar en máquinas con poca RAM. Puppeteer cierra el browser. Solución:
reiniciar el API o agregar `--disable-dev-shm-usage` a los `args` de
puppeteer en `whatsappService.js`.

**"Rate limit" de WhatsApp**
WhatsApp Business Web tiene un límite informal de ~1 msg/segundo para
evitar que te baneen la cuenta. Si enviás muchos mensajes en ráfaga, poné
un delay entre envíos o usá una cola. Para el volumen de Drip Burger
(algunos pedidos por noche) no debería ser un problema.

**El mensaje no llega al cliente pero el endpoint devolvió OK**
Puede ser que el número no tenga WhatsApp o que el helper `normalizePhone`
esté formateando mal. Verificá el log `WhatsApp enviado OK` — muestra el
`wa id`, que es el ID interno de WhatsApp para ese chat. Si existe, el
mensaje llegó. Si el número no tiene WhatsApp, `sendMessage` tira y el
endpoint responde con `success: false, error: ...`.
