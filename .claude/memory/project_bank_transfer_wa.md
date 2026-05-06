---
name: Flujo WA en transferencia bancaria
description: Endpoint /orders/send-bank-transfer-info manda WA con datos del banco + pedido de comprobante; banner en confirmación.
type: project
originSessionId: 2ff2d5f9-9835-48f0-bdeb-e5e2dc461ec7
---
Cuando un cliente elige `Transferencia`, después de crear el pedido se dispara `POST /orders/send-bank-transfer-info` ([apps/api/src/routes/orders.js](../../../../drip-burger/apps/api/src/routes/orders.js) ~línea 179), que lee `settings.transferencia_titular/alias/cbu` y manda mensaje al cliente con: nº pedido + total + datos bancarios + pedido de foto del comprobante.

`ConfirmationPage` recibe el resultado por `navigate state.bankWa = { messageSent, phoneNormalized, reason }` y muestra:
- Banner verde "Te mandamos los datos al +54..." si WA salió.
- Banner amber con titular/alias/CBU copiables si WA falló (no inicializado, deshabilitado, datos no cargados).

**Why:** El cliente quería un loop cerrado: el local le manda los datos automáticamente y el cliente responde con la foto del comprobante en el mismo chat. Antes los datos se mostraban sólo en pantalla y el cliente debía escribir aparte. Commit: `91acca6` (2026-05-06).

**How to apply:**
- WA debe estar `ready` (sesión escaneada) y `integrations.enabled=true` para que el mensaje salga. Endpoint es tolerante: si falla, devuelve `success:true, messageSent:false, reason` y el front cae al fallback en pantalla.
- También se ajustó el polling de `/payments/status` en `ConfirmationPage` para que **sólo** corra cuando `paymentMethod === FORMA_PAGO.MERCADOPAGO` (antes pollaba cualquier "Transferencia" porque el modelo viejo confundía MP y banco).
- Si Bruno reporta que el cliente no recibe el WA: chequear `whatsappService.isReady()`, `integrations.whatsapp.enabled`, y que `settings` tenga al menos uno de titular/alias/cbu cargados.
