import React from 'react';
import { MEDALLION_LABELS, FORMA_PAGO, PAYMENT_STATUS } from '@/lib/orderConstants';

const fmtPrice = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDateTimeAr = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const ar = new Date(
      d.getTime() + (-3 * 60 * 60 * 1000) - d.getTimezoneOffset() * 60 * 1000
    );
    const dd = String(ar.getDate()).padStart(2, '0');
    const mm = String(ar.getMonth() + 1).padStart(2, '0');
    const yyyy = ar.getFullYear();
    const hh = String(ar.getHours()).padStart(2, '0');
    const min = String(ar.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
  } catch (e) {
    return '';
  }
};

const PRINT_CSS = `
@page {
  size: 80mm auto;
  margin: 3mm;
}
@media print {
  html, body {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body * {
    visibility: hidden !important;
    box-shadow: none !important;
  }
  #delivery-ticket-print,
  #delivery-ticket-print * {
    visibility: visible !important;
    color: #000 !important;
    background: transparent !important;
  }
  #delivery-ticket-print {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 74mm !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }
}

#delivery-ticket-print { display: none; }

#delivery-ticket-print .dt-brand {
  font-size: 22pt;
  font-weight: 900;
  text-align: center;
  letter-spacing: 0.04em;
  line-height: 1.1;
  margin: 2pt 0;
}
#delivery-ticket-print .dt-divider-heavy {
  border: 0;
  border-top: 3px double #000;
  margin: 4pt 0;
  height: 0;
}
#delivery-ticket-print .dt-divider-light {
  border: 0;
  border-top: 1px dashed #000;
  margin: 3pt 0;
  height: 0;
}
#delivery-ticket-print .dt-section-title {
  font-size: 14pt;
  font-weight: 900;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.05em;
  margin: 2pt 0;
}
#delivery-ticket-print .dt-meta {
  font-size: 10pt;
  line-height: 1.3;
}
#delivery-ticket-print .dt-block { margin: 4pt 0; }
#delivery-ticket-print .dt-customer-name {
  font-size: 20pt;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1.1;
  word-wrap: break-word;
}
#delivery-ticket-print .dt-phone {
  font-size: 13pt;
  font-weight: 700;
  margin-top: 4pt;
}
#delivery-ticket-print .dt-address-label {
  font-size: 12pt;
  font-weight: 900;
  text-transform: uppercase;
  margin-top: 6pt;
  letter-spacing: 0.02em;
}
#delivery-ticket-print .dt-address {
  font-size: 26pt;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1.05;
  margin-top: 2pt;
  word-wrap: break-word;
}
#delivery-ticket-print .dt-item {
  display: flex;
  justify-content: space-between;
  gap: 6pt;
  margin: 3pt 0;
  font-size: 12pt;
  line-height: 1.25;
}
#delivery-ticket-print .dt-item-name { font-weight: 700; flex: 1; }
#delivery-ticket-print .dt-item-price {
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
#delivery-ticket-print .dt-totals-row {
  display: flex;
  justify-content: space-between;
  font-size: 12pt;
  margin: 2pt 0;
}
#delivery-ticket-print .dt-total-row {
  display: flex;
  justify-content: space-between;
  font-size: 18pt;
  font-weight: 900;
  margin: 4pt 0 2pt;
  letter-spacing: 0.02em;
}
#delivery-ticket-print .dt-payment-frame {
  border: 4px solid #000;
  padding: 10pt 6pt;
  text-align: center;
  margin: 10pt 0;
}
#delivery-ticket-print .dt-payment-headline {
  font-size: 22pt;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.02em;
  word-wrap: break-word;
}
#delivery-ticket-print .dt-payment-method {
  font-size: 18pt;
  font-weight: 900;
  text-transform: uppercase;
  margin-top: 8pt;
  letter-spacing: 0.08em;
}
#delivery-ticket-print .dt-thanks {
  text-align: center;
  font-size: 14pt;
  font-weight: 900;
  text-transform: uppercase;
  margin: 6pt 0;
  letter-spacing: 0.04em;
}
`;

const DeliveryTicket = ({ order }) => {
  if (!order) return null;

  const items = order.items || [];
  const shipping = order.precio_envio_snapshot || 0;
  const itemsTotal = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );
  const total = order.totalAmount || itemsTotal + shipping;

  const paymentMethod = order.paymentMethod || order.forma_pago || '';
  const isCash = paymentMethod === FORMA_PAGO.CASH;
  const isTransfer = paymentMethod === FORMA_PAGO.TRANSFER;
  const isPaid = order.paymentStatus === PAYMENT_STATUS.PAID;

  let paymentHeadline;
  if (isCash && !isPaid) {
    paymentHeadline = `>>> COBRAR ${fmtPrice(total)} <<<`;
  } else if (isCash && isPaid) {
    paymentHeadline = '>>> YA COBRADO <<<';
  } else if (isTransfer) {
    paymentHeadline = '>>> PAGADO <<<';
  } else {
    paymentHeadline = isPaid ? '>>> PAGADO <<<' : `>>> COBRAR ${fmtPrice(total)} <<<`;
  }
  const paymentMethodLabel = (paymentMethod || '—').toUpperCase();

  const renderItem = (item, idx) => {
    const qty = item.quantity || 1;
    const hasPatty = item.hasMedallions !== false && item.pattyCount;
    const pattyLabel = hasPatty
      ? ` · ${MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}${
          item.pattyCount > 1 ? ' MEDALLONES' : ' MEDALLÓN'
        }`
      : '';
    const lineTotal = (item.price || 0) * qty;
    return (
      <div key={idx} className="dt-item">
        <div className="dt-item-name">
          {qty}× {(item.productName || '').toUpperCase()}
          {pattyLabel}
        </div>
        <div className="dt-item-price">{fmtPrice(lineTotal)}</div>
      </div>
    );
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div
        id="delivery-ticket-print"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        <div className="dt-brand">DRIP BURGER</div>
        <hr className="dt-divider-heavy" />

        <div className="dt-block dt-meta">
          <div style={{ fontWeight: 900, fontSize: '11pt' }}>
            PEDIDO #{order.orderNumber || order.id}
          </div>
          <div>{formatDateTimeAr(order.created)}</div>
          {order.deliveryTimeSlot && (
            <div>
              Horario entrega:{' '}
              <strong style={{ fontSize: '12pt' }}>{order.deliveryTimeSlot}</strong>
            </div>
          )}
        </div>

        <hr className="dt-divider-heavy" />
        <div className="dt-section-title">Cliente</div>
        <hr className="dt-divider-heavy" />

        <div className="dt-block">
          <div className="dt-customer-name">{order.customerName || '—'}</div>
          {order.customerPhone && (
            <div className="dt-phone">Tel: {order.customerPhone}</div>
          )}
          <div className="dt-address-label">Dirección</div>
          <div className="dt-address">{order.customerAddress || '—'}</div>
        </div>

        <hr className="dt-divider-heavy" />
        <div className="dt-section-title">Pedido</div>
        <hr className="dt-divider-heavy" />

        <div className="dt-block">
          {items.length === 0 ? (
            <div className="dt-meta">Sin ítems</div>
          ) : (
            items.map(renderItem)
          )}

          <hr className="dt-divider-light" />
          <div className="dt-totals-row">
            <span>Subtotal:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtPrice(itemsTotal)}
            </span>
          </div>
          <div className="dt-totals-row">
            <span>Envío:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtPrice(shipping)}
            </span>
          </div>
          <hr className="dt-divider-light" />
          <div className="dt-total-row">
            <span>TOTAL:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtPrice(total)}
            </span>
          </div>
        </div>

        <div className="dt-payment-frame">
          <div className="dt-payment-headline">{paymentHeadline}</div>
          <div className="dt-payment-method">{paymentMethodLabel}</div>
        </div>

        <hr className="dt-divider-heavy" />
        <div className="dt-thanks">¡Gracias!</div>
        <hr className="dt-divider-heavy" />
      </div>
    </>
  );
};

export default DeliveryTicket;
