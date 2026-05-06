---
name: Modelo de pago de 3 valores
description: forma_pago en orders acepta directo Efectivo/Transferencia/Mercado Pago. Sin mappers ni campos auxiliares.
type: project
originSessionId: 2ff2d5f9-9835-48f0-bdeb-e5e2dc461ec7
---
`orders.forma_pago` es un SelectField con valores **exactos**: `'Efectivo' | 'Transferencia' | 'Mercado Pago'`. El frontend manda directo cualquiera de los 3 (constante `FORMA_PAGO` en [apps/web/src/lib/orderConstants.js](../../../../drip-burger/apps/web/src/lib/orderConstants.js)). `paymentMethod` se setea al mismo valor.

- `Mercado Pago` → pago online vía MP, webhook automático actualiza `paymentStatus`.
- `Transferencia` → transferencia bancaria manual (CBU/alias), admin la valida desde el dashboard.
- `Efectivo` → cobro en delivery.

**Why:** Hubo 2 intentos previos overcomplicados (mapper UI→schema con `FORMA_PAGO_UI`, y un campo separado `ui_payment_choice` con migración). Bruno explícitamente revirtió todo a este diseño limpio porque el modelo de 3 valores nativos en el SelectField no necesitaba intermediarios. Commits relevantes: `4a101d4` (intro), `7887d10`/`4f446df` (intentos fallidos), `ddd895b` (revert al diseño limpio).

**How to apply:**
- Migración requerida: `apps/pocketbase/pb_migrations/1777700000_extend_forma_pago_select.js` debe estar aplicada (extiende el SelectField a los 3 valores). Si no lo está, MP rebota con `validation_invalid_value`.
- Nunca metas mappers UI↔schema ni "valores intermedios" como `transferencia_mp`. Si necesitás distinguir más casos, ampliá el SelectField directamente con migración.
- En admin/print/cobro: filtrar con `=== FORMA_PAGO.MERCADOPAGO` vs `=== FORMA_PAGO.TRANSFERENCIA`. MP pendiente NO se cobra a mano (espera webhook); transferencia pendiente sí (botón "Cobrar" verde).
