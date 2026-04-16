# Session Handoff — Drip Burger

**Fecha de handoff:** 2026-04-16
**Última branch/commit:** `main` @ `f4eb5d4` (refactor ui header + admin filtros) + trabajo sin commitear posterior.

---

## 1. Stack y entornos

| Componente | Path | Puerto | Notas |
|---|---|---|---|
| Frontend (React/Vite) | `apps/web` | 3001 | `npm run dev` |
| API (Node/Express) | `apps/api` | 3002 | `node src/main.js`, env `apps/api/.env` |
| PocketBase (Docker) | `apps/pocketbase` | 8090 | Container: `6cfef7f4cbb1` (`burgapp_pocketbase`), imagen `ghcr.io/muchobien/pocketbase:latest` |

**Credenciales dev:**
- Admin PB: `admin@drip.com` / `admin123`
- Los defaults están hardcodeados en `apps/api/src/utils/pocketbaseClient.js:12` y migrations `1775894534` + `1776050044`

**Variables env relevantes (`apps/api/.env`):**
- `PORT=3002`
- `POCKETBASE_URL=http://localhost:8090`
- `CORS_ORIGIN=*`

---

## 2. Arquitectura de datos (PocketBase)

### Collections principales
- **users** — `email`, `password`, `role` (CUSTOMER/ADMIN), `nombre_apellido`, `telefono`, `direccion`
- **products** — `name`, `description`, `hasMedallions` (bool), precios: `simplePrice`/`doublePrice`/`triplePrice`/`quadruplePrice`/`quintuplePrice` / `fixedPrice`, `available` (bool), `image`, `internalNote`
- **orders** — `items` (JSON), `customerName`, `customerPhone`, `customerAddress`, `deliveryTimeSlot`, `paymentMethod`, `paymentStatus` (Pendiente/Pagado), `orderStatus` (Pendiente / En preparación / Listo / En camino / Finalizado / Cancelado), `totalAmount`, `precio_envio_snapshot`, `user_id` (relation), `jornadaId` (relation, nullable), `orderNumber` (auto-generado por hook)
- **settings** — singleton: `precio_envio`, `hora_apertura`, `hora_cierre`, `maxMedallionsPerSlot` (default 20), `slotCapacities` (legacy vacío)
- **integrations** — 2 registros seed: `whatsapp` y `mercadopago` con `enabled`/`status`/`config` (JSON con accessToken encriptado AES-256-GCM para MP)
- **jornadas** — fila por apertura/cierre de caja: `fecha`, `horaApertura`/`horaCierre`, `montoInicial`/`montoCierre`, totales calculados al cierre, `estado` (abierta/cerrada), `adminId`
- **movimientos_caja** — ingresos/egresos manuales: `jornadaId`, `tipo` (ingreso/egreso), `monto`, `motivo`, `adminId`

### Rules críticas aplicadas
- **`orders`**: listRule/viewRule = admin o `user_id = @request.auth.id`; createRule público (checkout anónimo); update/delete solo ADMIN.
- **`jornadas`** y **`movimientos_caja`**: todo solo ADMIN.
- **`integrations`**: solo ADMIN.

### Migrations aplicadas (última: 1777000002)
Listado en `apps/pocketbase/pb_migrations/`:
- `1776600000_add_slot_capacities_to_settings.js` (legacy, slotCapacities)
- `1776700000_replace_slot_capacities_with_max_medallions.js` (cambio a capacity global)
- `1776800000_secure_orders_rules.js` (fix crítico PII)
- `1776800001_add_quadruple_quintuple_prices.js`
- `1776900000_add_cancelado_to_orderStatus.js`
- `1777000000_create_jornadas.js`
- `1777000001_create_movimientos_caja.js`
- `1777000002_add_jornadaId_to_orders.js`

**Todas idempotentes**. Se aplican al restart del container. Para forzar: `docker restart 6cfef7f4cbb1`.

---

## 3. Hook PocketBase clave

**`apps/pocketbase/pb_hooks/order-confirmation.pb.js`** — onRecordCreate de `orders`:

1. **Validación de capacidad por medallones (server-side hard gate)**:
   - Lee `settings.maxMedallionsPerSlot` (default 20)
   - Parsea `record.getString("items") + JSON.parse` (NO uses `.get()` → devuelve wrapper Go que no pasa `Array.isArray`)
   - Valida que no haya `pattyCount` o `quantity` negativos (reject con `BadRequestError`)
   - Suma medallones del pedido entrante: `pattyCount * quantity` si `hasMedallions !== false` (clamp con `Math.max(0, ...)`)
   - Suma medallones ya agendados en el slot del día (excluyendo `Cancelado`)
   - Filtro crítico: `created >= "${todayStart}"` donde todayStart usa `.toISOString().replace("T", " ")` porque PB compara datetime como string y su formato usa espacio, no T
   - Si `used + new > max` → throw `BadRequestError("El horario X solo tiene N medallones...")`
   - Fail-open ante errores de DB para no bloquear por bugs del hook

2. **Asignación de jornadaId**: busca `jornadas` con `estado = "abierta"` y setea `e.record.set("jornadaId", ...)`. Si no hay jornada, deja vacío (pedido "huérfano").

3. **orderNumber y estados iniciales**: `ORD-YYYYMMDD-XXXXXX` + paymentStatus=Pendiente + orderStatus=Pendiente.

**IMPORTANTE sobre Goja/PB**: los callbacks corren en VM aislado. Las funciones helpers declaradas al TOP-LEVEL del archivo **NO están visibles** dentro del callback. Todo helper debe estar INLINED dentro del callback.

Log `[slot-capacity] slot=X used=N new=M max=K` activo (quitar si molesta).

---

## 4. Endpoint API clave

**`apps/api/src/routes/slots.js`** — `GET /slots/availability` (público, sin auth):

```json
{
  "date": "YYYY-MM-DD",
  "maxMedallionsPerSlot": 10,
  "slots": [
    { "slot": "20:30", "usedMedallions": 7, "available": 3, "full": false },
    ...
  ]
}
```

- Calcula "hoy" en TZ Argentina (UTC-3, sin DST): desde las 03:00 UTC hasta las 03:00 UTC del día siguiente
- Filter de PB con T→espacio fix (mismo issue que el hook)
- Respeta `maxMedallionsPerSlot = 0` legítimamente (usa `n >= 0`)
- Excluye orders con `orderStatus = "Cancelado"` del conteo → al cancelar un pedido, los medallones se liberan automáticamente

Clamp defensivo de negativos en `countMedallions`.

Mount en `apps/api/src/routes/index.js`: `router.use('/slots', slotsRouter)`.

---

## 5. Estructura frontend

### AdminDashboard — el corazón del admin
**Path:** `apps/web/src/pages/AdminDashboard.jsx` (~2000 líneas).

**Tabs actuales (orden):** Pedidos → Cocina → Productos → Clientes → Caja → Menú → Reportes → Config.

Cada tab es un `<TabsContent>` con su propio contenido. State controlado via `activeTab` + `onValueChange`. Título del browser (`<Helmet>`) dinámico via `TAB_TITLES`.

**Top bar derecho**: solo botón "Editar Pedidos" (rojo), condicional `activeTab === 'orders'`. Los botones Reportes/Config se eliminaron (ahora son tabs).

**Top bar izquierdo**: botón "Volver" que va a `/` (se mantuvo por decisión del usuario).

### Componentes extraídos
- `apps/web/src/pages/admin/MenuPreviewContent.jsx` — grilla de productos que ven los clientes, embebida en admin (usa `ProductCard` normal, con Agregar funcional — el admin puede verificar cambios).
- `SettingsPage.jsx` — exporta `{ SettingsContent }` (named) + `SettingsPage` (default, wrapper con Header + container). AdminDashboard importa el named.
- `SalesReportingPage.jsx` — mismo patrón: `{ ReportsContent }` + wrapper.

### CajaCard (tab Caja — dentro de AdminDashboard)
Estados:
- **A (sin jornada)**: card amarilla con input monto inicial + botón "Iniciar Jornada"
- **B (jornada abierta)**: card verde con resumen en vivo (cobros efectivo/transfer, ingresos/egresos manuales, efectivo en caja), lista de movimientos, botones "+ Ingreso" (verde) / "- Egreso" (rojo), botón rojo "Cerrar Jornada"

**Al abrir jornada**: adopta orders huérfanos (sin jornadaId, creados hoy) en batch via PATCH con el nuevo jornadaId.

**Al cerrar jornada**: modal con breakdown completo + input "efectivo en caja" → cuadre en vivo (diferencia). Persiste totales computados: `totalEfectivo`, `totalTransferencias`, `totalPedidos`, `pedidosCancelados`, `montoCancelados`, `efectivoEsperado`, `cuadre`.

Recibe `jornada` como prop desde AdminDashboard (single source of truth), dispara `onJornadaChange()` tras open/close.

### Dashboard/Cocina con jornada
- **AdminDashboard** tiene state `jornadaActiva` con polling 30s.
- **Tab Pedidos**: si no hay jornada → banner naranja sticky + pedidos con `opacity-50`. Filter: con jornada → solo `order.jornadaId === jornada.id`. Sin jornada → huérfanos del día.
- **Tab Cocina**: sin jornada → card centrada "Iniciá la jornada". Con jornada → `KitchenView` recibe orders filtradas por jornada.
- **Guard `requireJornada()`** en 5 handlers (handleMarkPaid, handleSendWhatsApp, handleUpdateOrderStatus, handleSendToKitchen, handleMarkReady) → toast "Primero iniciá la jornada..." si no hay jornada.
- **Chips de ocupación** (integrados en botones de horario): solo con jornada activa.

### Otras páginas admin
- `apps/web/src/pages/EditOrdersPage.jsx` — página standalone, se abre desde el botón rojo. Lista pedidos pendientes, filtros por slot + cliente, cancelación con modal de confirmación. La cancelación libera medallones automáticamente (hook + endpoint excluyen Cancelado).
- `apps/web/src/pages/SettingsPage.jsx` (wrapper standalone /gestion/config) — deep-links legacy siguen funcionando.
- `apps/web/src/pages/SalesReportingPage.jsx` (wrapper /gestion/reportes) — idem.

### Rutas en `apps/web/src/App.jsx`
```
/                         → HomePage
/menu                     → CustomerMenuPage (Header público)
/carrito                  → CartPage
/confirmacion/:orderId    → ConfirmationPage
/login                    → LoginPage
/mis-pedidos              → OrderHistoryPage
/gestion                  → AdminDashboard (AdminRoute)
/gestion/reportes         → SalesReportingPage (AdminRoute)
/gestion/config           → SettingsPage (AdminRoute)
/gestion/editar-pedidos   → EditOrdersPage (AdminRoute)
/gestion/configuracion    → Navigate → /gestion/config
```

### Header público (`apps/web/src/components/Header.jsx`)
- Logo Drip Burger a la izquierda + crédito `© 2026 · Crafted by BPSG` con font-mono alineado con "Streetwear Burgers"
- Orden derecha: `[🛒 Carrito] [👤 Mi Cuenta] [PANEL ADMIN]` (este último sólo si `isAuthenticated && isAdmin`)
- Carrito usa `ShoppingCart` con ícono h-7/h-8
- User icon h-7 (más grande que defecto)
- PANEL ADMIN sólido naranja `h-9 px-3 text-xs`

### ProductCard (`apps/web/src/components/ProductCard.jsx`)
- Contador numérico 1–5 medallones con límite dinámico (`maxPatty` = 5 si `quintuplePrice > 0`, sino 4 si `quadruplePrice > 0`, sino 3)
- Preview de precios con Simple/Doble/Triple siempre, Cuádruple/Quíntuple condicional
- Productos sin medallones (hasMedallions=false): sin contador, solo botón Agregar

### CartContext (`apps/web/src/contexts/CartContext.jsx`)
Persiste en localStorage. Cada item incluye `hasMedallions` desde el producto (importante para server-side validation).

### CartPage / ConfirmationPage
- Display items como `{qty}× {nombre} · {N} medallones` (cantidad solo si > 1)
- Nuggets muestran solo nombre + precio (sin mención de medallones)
- Uses `MEDALLION_LABELS` centralizado en `orderConstants.js`

---

## 6. Constants centrales — `apps/web/src/lib/orderConstants.js`

```js
ORDER_STATUS = { PENDING, COOKING, READY, IN_TRANSIT, COMPLETED, CANCELLED }
PAYMENT_STATUS = { PENDING, PAID }
FORMA_PAGO = { CASH: 'Efectivo', TRANSFER: 'Transferencia' }
MEDALLION_LABELS = { 1: 'Simple', 2: 'Doble', 3: 'Triple', 4: 'Cuádruple', 5: 'Quíntuple' }
```

---

## 7. Problemas conocidos / pendientes del audit

Del reporte `AUDIT_E2E_2026-04-15.md` (en la raíz del repo):

### Medios pendientes
- AuthModal "Recordarme" es decorativo — AuthContext.login ignora el 3er param (siempre localStorage). (`AuthContext.jsx:39-42`)
- OrderHistoryPage: loading infinito si `currentUser` es null al mount (falta `setLoading(false)` en early return). (`OrderHistoryPage.jsx:26-27`)
- RegistrationModal bypassa `useAuth().login()` — llama directo `pb.authWithPassword`.
- CartPage sin toast cuando `/slots/availability` falla — console.error silencioso.
- Password admin `admin123` hardcodeado en 2 migrations y `pocketbaseClient.js`. Requiere env var en prod.
- CartPage: botón `+` en cart sin cap por slot disponibility (permite incrementar libremente; validación solo en pre-flight).
- ProductCard: productos sin medallones hard-codean quantity=1 al add (no hay selector de cantidad en el card).

### Menores
- ConfirmationPage/CartPage mostraban "1p" para Nuggets — resuelto con display condicional
- AdminDashboard sort/filter inconsistency para `orderStatus` undefined
- OrderHistoryPage filter con interpolación sin sanitizar (IDs PB son safe, riesgo práctico 0)

### Verificado OK
- Capacidad medallones end-to-end
- Persistencia auth con F5
- Seguridad: `/integrations/*` 401/403, orders listRule cerrado
- MercadoPago NO expone accessToken completo
- `.env` + `pb_data/` gitignored

---

## 8. Decisiones UX importantes

1. **`hora_cierre = ""` → local cerrado** (useStoreHours retorna `false` si alguno es null, antes era `true` tolerante). Actualmente la DB tiene `hora_cierre=""` — el local figura cerrado hasta que el admin configure ambos horarios.
2. **Volver del admin → `/`** (se mantuvo por decisión explícita del usuario: "si hace cambios va a querer verlo para chequear", el logo del Header público también sirve de escape).
3. **Menú tab embebido → funcional**: el admin ve la vista cliente completa con botón Agregar operativo (para verificar cambios en vivo, no solo preview).
4. **Editar Pedidos** sólo visible en tab Pedidos (no en otros contextos).
5. **Una sola jornada abierta** a la vez — enforced a nivel app (no por constraint DB).
6. **Pedidos huérfanos** (sin jornadaId) creados hoy se adoptan automáticamente al abrir jornada.

---

## 9. Flujo de servicio típico (ejemplo)

1. Admin login → `/gestion` → tab Caja → ingresa monto inicial ($5.000) → "Iniciar Jornada"
2. Sistema adopta pedidos huérfanos del día (si hay)
3. Clientes hacen pedidos en `/carrito` → hook valida capacidad medallones + asigna `jornadaId`
4. Admin ve pedidos en tab Pedidos, marca Cobrado / Enviado / Entregado
5. Cocina ve pedidos en tab Cocina (filtrados por jornada), marca Listo
6. Durante servicio: admin puede registrar ingresos/egresos manuales desde tab Caja
7. Al finalizar servicio → "Cerrar Jornada" → modal con breakdown + cuadre en vivo → confirma
8. Jornada cerrada, totales persistidos, tab Pedidos y Cocina se limpian → vuelve a Estado A

---

## 10. Logs + procesos corriendo

- **API**: job ID `b6h5pg0pg` corriendo en background (se reinicia manualmente con `kill -TERM $PID && cd apps/api && node src/main.js &`)
- **PB Docker**: siempre corriendo, logs con `docker logs 6cfef7f4cbb1` (incluye `[slot-capacity]` debug del hook)
- **Vite dev**: el usuario lo corre aparte

---

## 11. Commits de esta sesión (los relevantes)

```
4cdd9dc initial commit - drip burger app (arranque de sesión)
594ef2f feat: capacidad medallones, 5 patty levels, fixes críticos audit E2E
e5c2f85 chore: ignorar reportes de auditoría
f4eb5d4 refactor(ui): header actions + admin dashboard filtros (último commit)
```

**Cambios post-commit f4eb5d4 sin commitear:**
- Editar Pedidos + estado Cancelado (collection rules + hook + AdminDashboard + EditOrdersPage)
- Caja Parte 1 (jornadas + movimientos_caja + tab CAJA básico)
- Caja Parte 2 (movimientos manuales + resumen en vivo + modal cierre con cuadre)
- Caja Parte 3 (integración con Pedidos/Cocina + jornada compartida + huérfanos)
- Consolidación final en tabs: Menú + Reportes + Config integrados al admin

---

## 12. Cosas que NO tocar sin pedir

- El hook `order-confirmation.pb.js` — cualquier cambio ahí rompe capacity validation + jornada assignment
- El filter de datetime en hook y slots.js (`.replace('T', ' ')`) — es el fix crítico de un bug sutil de PB
- Las collection rules de orders (PII exposure)
- La estructura de tabs del AdminDashboard (recién consolidada por el usuario)

---

## 13. Reportes previos en el repo

- `AUDIT_E2E_2026-04-15.md` — auditoría full 23 bugs categorizados (se ejecutaron los críticos)
- Este handoff `SESSION_HANDOFF_2026-04-16.md`

---

## 14. Patrones visuales canónicos

- Dark `#0a0a0a`, cards `#1a1a1a`, primary `#F5A800` (naranja)
- Fuente Bangers para títulos (uppercase), tracking tight/wide según contexto
- `border-l-[4px]` o `[6px]` como accent lateral en cards importantes (color según estado)
- Botones: `h-8 text-[11px]` top bar, `h-10` action buttons, `h-11`/`h-12` primary
- Font-black uppercase para labels de header
- Tabular-nums en todo lo numérico (montos, cantidades, conteos)

---

Fin del handoff. Para iniciar sesión nueva: leer este archivo + ver `git log` y `git status` actual para detectar cualquier cambio posterior.
