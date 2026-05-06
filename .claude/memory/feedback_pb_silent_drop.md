---
name: PocketBase silently drops unknown fields
description: Cuando se mandan campos inexistentes en el schema, PB no falla — los descarta y guarda el resto. Validar post-save siempre.
type: feedback
originSessionId: 2ff2d5f9-9835-48f0-bdeb-e5e2dc461ec7
---
Al hacer `pb.collection('X').create/update(payload)` PocketBase **silenciosamente descarta** los campos que no existen en el schema (ej: porque una migración no se aplicó). El record se crea/actualiza sin error pero faltando campos.

**Why:** Bruno se comió múltiples bugs en producción donde el frontend enviaba un campo nuevo (ej: `takeAway`, `clienteId`, `ui_payment_choice`) y PB devolvía 200 OK pero el campo nunca persistía. El admin veía datos faltantes y creía que era bug del front.

**How to apply:**
- Después de cada create/update crítico, comparar los campos enviados vs los del record devuelto. Si hay campos faltantes → toast rojo "Schema desactualizado, avisar al admin" en vez de fake success. Ya hay este patrón aplicado en `TransferenciaCard` y `OperacionCard` ([apps/web/src/pages/SettingsPage.jsx](../../../../drip-burger/apps/web/src/pages/SettingsPage.jsx)).
- En el payload del checkout, cargar campos opcionales **sólo si aplican** (ej: `if (formData.takeAway) orderData.takeAway = true`) para que un PB sin migrar no rechace el create — pero esto es la otra cara: si un campo es crítico, validá post-save.
- Cuando agregues un campo nuevo: siempre crear migración idempotente + escribir validación post-save en el cliente.
