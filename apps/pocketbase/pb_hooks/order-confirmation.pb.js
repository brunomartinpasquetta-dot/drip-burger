/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  // Generate unique orderNumber: ORD-YYYYMMDD-XXXXX
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = year + month + day;
  
  // Get the count of orders created today to generate sequential number
  const todayStart = new Date(year, now.getMonth(), now.getDate());
  const todayEnd = new Date(year, now.getMonth(), now.getDate() + 1);
  
  const filter = "createdAt >= '" + todayStart.toISOString() + "' && createdAt < '" + todayEnd.toISOString() + "'";
  const existingOrders = $app.findRecordsByFilter("orders", filter, "-created", 1000);
  
  const sequenceNum = String(existingOrders.length + 1).padStart(5, '0');
  const orderNumber = "ORD-" + dateStr + "-" + sequenceNum;
  
  e.record.set("orderNumber", orderNumber);
  e.record.set("paymentStatus", "PENDIENTE");
  e.record.set("orderStatus", "Pendiente");
  e.next();
}, "orders");