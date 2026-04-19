// Impresión térmica directa vía WebUSB + ESC/POS.
// Sin window.print, sin PDF, sin diálogo del navegador.
// Sólo Chrome/Edge (WebUSB no existe en Safari ni Firefox).

let usbDevice = null;
let endpointOut = null;

const USB_FILTERS = [
  { vendorId: 0x0483 }, // Xprinter
  { vendorId: 0x1a86 }, // Xprinter (QinHeng / CH340 chipset)
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // HASAR
  { vendorId: 0x0416 }, // Genérico Winbond
  { vendorId: 0x154f }, // SNBC / BTP
  { vendorId: 0x0fe6 }, // ICS Advent / genéricos
];

async function claimFirstOutEndpoint(device) {
  const config = device.configuration;
  for (const iface of config.interfaces) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find((e) => e.direction === 'out');
      if (out) {
        await device.claimInterface(iface.interfaceNumber);
        if (alt.alternateSetting !== 0) {
          try {
            await device.selectAlternateInterface(
              iface.interfaceNumber,
              alt.alternateSetting
            );
          } catch (e) {
            // algunos devices no soportan selectAlternateInterface; ignorar
          }
        }
        return out;
      }
    }
  }
  throw new Error('No se encontró endpoint OUT en la impresora');
}

export async function connectPrinter() {
  if (usbDevice && usbDevice.opened && endpointOut) return true;

  if (!navigator.usb) {
    throw new Error(
      'Este navegador no soporta WebUSB. Usá Chrome o Edge en desktop.'
    );
  }

  try {
    // Reutilizar permisos previos si existen
    const granted = await navigator.usb.getDevices();
    let device = granted.find((d) =>
      USB_FILTERS.some((f) => f.vendorId === d.vendorId)
    );

    if (!device) {
      device = await navigator.usb.requestDevice({ filters: USB_FILTERS });
    }

    if (!device.opened) await device.open();
    if (!device.configuration) await device.selectConfiguration(1);

    const out = await claimFirstOutEndpoint(device);

    usbDevice = device;
    endpointOut = out;
    return true;
  } catch (err) {
    console.error('[escpos] connect failed:', err);
    usbDevice = null;
    endpointOut = null;
    throw err;
  }
}

export function isPrinterConnected() {
  return !!(usbDevice && usbDevice.opened && endpointOut);
}

export async function disconnectPrinter() {
  if (!usbDevice) return;
  try {
    await usbDevice.close();
  } catch (e) {
    // noop
  }
  usbDevice = null;
  endpointOut = null;
}

// ── Write helpers ───────────────────────────────────────────────

async function sendRaw(data) {
  if (!usbDevice || !usbDevice.opened || !endpointOut) {
    throw new Error('Impresora no conectada');
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  await usbDevice.transferOut(endpointOut.endpointNumber, bytes);
}

// CP437 fallback para "latin1"-like: sin tildes. ESC/POS clásico no maneja UTF-8
// sin configurar codepage, así que normalizamos caracteres antes de encodear.
function stripAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, (ch) => {
      const map = { '¡': '!', '¿': '?', '·': '-', '—': '-', '–': '-', '“': '"', '”': '"', '‘': "'", '’': "'" };
      return map[ch] || '?';
    });
}

const encoder = new TextEncoder();

async function cmd(...bytes) {
  await sendRaw(new Uint8Array(bytes.flat()));
}

async function text(str) {
  await sendRaw(encoder.encode(stripAccents(str)));
}

async function line(str = '') {
  await text(str + '\n');
}

async function separator(char = '=', width = 32) {
  await line(char.repeat(width));
}

const WIDTH = 32; // caracteres por línea a 80mm, font A (12×24)

async function lineWithPrice(label, price) {
  const priceStr = fmtPrice(price);
  const labelClean = stripAccents(String(label));
  const spaces = Math.max(1, WIDTH - labelClean.length - priceStr.length);
  await line(labelClean + ' '.repeat(spaces) + priceStr);
}

function fmtPrice(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
}

// ── ESC/POS commands ────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT:          [ESC, 0x40],
  CENTER:        [ESC, 0x61, 0x01],
  LEFT:          [ESC, 0x61, 0x00],
  BOLD_ON:       [ESC, 0x45, 0x01],
  BOLD_OFF:      [ESC, 0x45, 0x00],
  DOUBLE_SIZE:   [ESC, 0x21, 0x30], // doble ancho + doble alto
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH:  [ESC, 0x21, 0x20],
  NORMAL_SIZE:   [ESC, 0x21, 0x00],
  CUT:           [GS, 0x56, 0x42, 0x00], // corte parcial con feed
  FEED_3:        [ESC, 0x64, 0x03],
  CODEPAGE_858:  [ESC, 0x74, 0x13], // CP858 (euro + latín extendido)
};

// ── TICKET DE DELIVERY ──────────────────────────────────────────

export async function printDeliveryTicket(order) {
  await connectPrinter();

  const items = order.items || [];
  const shipping = order.precio_envio_snapshot || 0;
  const itemsTotal = items.reduce(
    (s, it) => s + (it.price || 0) * (it.quantity || 0),
    0
  );
  const total = order.totalAmount || itemsTotal + shipping;

  const paymentMethod = order.paymentMethod || order.forma_pago || '';
  const isCash = paymentMethod === 'Efectivo';
  const isTransfer = paymentMethod === 'Transferencia';
  const isPaid = order.paymentStatus === 'Pagado';

  await cmd(CMD.INIT);
  await cmd(CMD.CODEPAGE_858);

  // HEADER
  await cmd(CMD.CENTER);
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_SIZE);
  await line('DRIP BURGER');
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  await separator('=');

  // META
  await cmd(CMD.LEFT);
  await cmd(CMD.BOLD_ON);
  await line('#' + (order.orderNumber || order.id));
  await cmd(CMD.BOLD_OFF);
  if (order.deliveryTimeSlot) {
    await line('Entrega: ' + order.deliveryTimeSlot);
  }
  await separator('=');

  // CLIENTE
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_HEIGHT);
  await line((order.customerName || '').toUpperCase());
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  if (order.customerPhone) {
    await cmd(CMD.BOLD_ON);
    await line('Tel: ' + order.customerPhone);
    await cmd(CMD.BOLD_OFF);
  }

  // DIRECCIÓN — doble tamaño (grande y obvio para el delivery)
  await line('');
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_SIZE);
  await line((order.customerAddress || '-').toUpperCase());
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  await separator('=');

  // ITEMS
  for (const item of items) {
    const qty = item.quantity || 1;
    const hasPatty = item.hasMedallions !== false && item.pattyCount;
    const pattyLabel = hasPatty ? ' x' + item.pattyCount + 'med' : '';
    const label =
      qty + 'x ' + (item.productName || '').toUpperCase() + pattyLabel;
    const lineTotal = (item.price || 0) * qty;
    await cmd(CMD.BOLD_ON);
    await lineWithPrice(label, lineTotal);
    await cmd(CMD.BOLD_OFF);
  }

  await separator('-');
  await lineWithPrice('Subtotal:', itemsTotal);
  await lineWithPrice('Envio:', shipping);
  await separator('-');
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_HEIGHT);
  await lineWithPrice('TOTAL:', total);
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);

  // ESTADO DE PAGO
  await separator('*');
  await cmd(CMD.CENTER);
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_SIZE);
  if (isCash && !isPaid) {
    await line('COBRAR');
    await line(fmtPrice(total));
    await cmd(CMD.NORMAL_SIZE);
    await cmd(CMD.DOUBLE_HEIGHT);
    await line('EFECTIVO');
  } else if (isCash && isPaid) {
    await line('YA COBRADO');
    await cmd(CMD.NORMAL_SIZE);
    await cmd(CMD.DOUBLE_HEIGHT);
    await line('EFECTIVO');
  } else if (isTransfer) {
    await line('PAGADO');
    await cmd(CMD.NORMAL_SIZE);
    await cmd(CMD.DOUBLE_HEIGHT);
    await line('TRANSFERENCIA');
  } else {
    await line(isPaid ? 'PAGADO' : 'COBRAR ' + fmtPrice(total));
  }
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  await separator('*');

  await cmd(CMD.CENTER);
  await line('');
  await line('Gracias por tu pedido!');

  await cmd(CMD.FEED_3);
  await cmd(CMD.CUT);
}

// ── COMANDA DE COCINA ───────────────────────────────────────────

export async function printKitchenOrder(orders, timeSlot) {
  await connectPrinter();

  if (!orders || orders.length === 0) {
    throw new Error('No hay pedidos para imprimir');
  }

  await cmd(CMD.INIT);
  await cmd(CMD.CODEPAGE_858);

  await cmd(CMD.CENTER);
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_SIZE);
  await line('COMANDA COCINA');
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  await separator('=');

  await cmd(CMD.CENTER);
  await cmd(CMD.BOLD_ON);
  await cmd(CMD.DOUBLE_SIZE);
  await line('TURNO ' + (timeSlot || 'TODOS'));
  await cmd(CMD.NORMAL_SIZE);
  await cmd(CMD.BOLD_OFF);
  await separator('=');

  await cmd(CMD.LEFT);
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const items = order.items || [];

    await cmd(CMD.BOLD_ON);
    await cmd(CMD.DOUBLE_HEIGHT);
    await line((order.customerName || 'SIN NOMBRE').toUpperCase());
    await cmd(CMD.NORMAL_SIZE);
    await cmd(CMD.BOLD_OFF);
    await line('#' + (order.orderNumber || order.id));

    let papasDelPedido = 0;
    for (const item of items) {
      const qty = item.quantity || 1;
      const isBurger = item.hasMedallions !== false;
      const pattyLabel = isBurger && item.pattyCount ? ' x' + item.pattyCount + 'med' : '';
      await cmd(CMD.BOLD_ON);
      await line(
        '  ' + qty + 'x ' + (item.productName || '').toUpperCase() + pattyLabel
      );
      await cmd(CMD.BOLD_OFF);
      if (isBurger) papasDelPedido += qty;
    }

    if (papasDelPedido > 0) {
      await cmd(CMD.BOLD_ON);
      await line('  + ' + papasDelPedido + ' papas fritas');
      await cmd(CMD.BOLD_OFF);
    }

    if (i < orders.length - 1) await separator('-');
  }

  await separator('=');
  await cmd(CMD.CENTER);
  await cmd(CMD.BOLD_ON);
  const totalPedidos = orders.length;
  let totalMedallones = 0;
  let totalPapas = 0;
  for (const o of orders) {
    for (const item of o.items || []) {
      const qty = item.quantity || 1;
      const isBurger = item.hasMedallions !== false;
      if (isBurger) {
        totalMedallones += (item.pattyCount || 0) * qty;
        totalPapas += qty;
      }
    }
  }
  await line(totalPedidos + ' pedidos');
  await line(totalMedallones + ' medallones');
  await line(totalPapas + ' papas fritas');
  await cmd(CMD.BOLD_OFF);

  await cmd(CMD.FEED_3);
  await cmd(CMD.CUT);
}
