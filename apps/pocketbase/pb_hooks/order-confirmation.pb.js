/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = year + month + day;

  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = "ORD-" + dateStr + "-" + suffix;

  e.record.set("orderNumber", orderNumber);
  e.record.set("paymentStatus", "Pendiente");
  e.record.set("orderStatus", "Pendiente");
  e.next();
}, "orders");
