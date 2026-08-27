import { jsPDF } from "jspdf";
import { PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import type { Order, OrderItem } from "@ecommerce/types";

// Documento simples (só texto, sem tabela/plugin extra) — suficiente pra
// enviar por WhatsApp/e-mail como comprovante do pedido para separação ou
// para o cliente.
export function downloadOrderPdf(order: Order, items: OrderItem[]) {
  const doc = new jsPDF();
  const marginX = 15;
  let y = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Pedido ${order.orderNumber}`, marginX, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Feito em ${new Date(order.createdAt).toLocaleDateString("pt-BR")}`, marginX, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Itens", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  items.forEach((item, i) => {
    const total = item.finalSubtotal ?? item.estimatedSubtotal;
    doc.text(`${i + 1}. ${item.name}`, marginX, y);
    doc.text(`R$ ${total.toFixed(2).replace(".", ",")}`, 195, y, { align: "right" });
    y += 5;
    doc.setTextColor(120);
    const qty = (total / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0);
    doc.text(`   ${qty} ${item.unitType} x R$ ${item.unitPrice.toFixed(2).replace(".", ",")}/${item.unitType}`, marginX, y);
    doc.setTextColor(0);
    y += 7;
  });

  y += 3;
  doc.setDrawColor(200);
  doc.line(marginX, y, 195, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Entrega", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const addressLines = doc.splitTextToSize(
    `${order.shippingAddress.street}, ${order.shippingAddress.number} — ${order.shippingAddress.neighborhood}, ${order.shippingAddress.city}/${order.shippingAddress.state} — ${order.shippingAddress.zipCode}`,
    180,
  );
  doc.text(addressLines, marginX, y);
  y += addressLines.length * 5 + 8;

  doc.setFont("helvetica", "bold");
  doc.text("Pagamento", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const paymentText =
    PAYMENT_METHOD_LABEL[order.paymentMethod] +
    (order.paymentMethod === "credit" && order.installments && order.installments > 1
      ? ` — ${order.installments}x de R$ ${(order.total / order.installments).toFixed(2).replace(".", ",")}`
      : "");
  doc.text(paymentText, marginX, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: R$ ${order.total.toFixed(2).replace(".", ",")}`, marginX, y);

  doc.save(`${order.orderNumber}.pdf`);
}
