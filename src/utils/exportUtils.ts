import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  ordersByStatus: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topProducts: { name: string; sold: number }[];
  paymentMethodStats: { method: string; count: number; revenue: number }[];
  successfulPayments: number;
  failedPayments: number;
  refundedOrders: number;
}

export const exportToCSV = (analytics: AnalyticsData) => {
  const lines: string[] = [];

  // Summary section
  lines.push("Sales Analytics Report");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("Summary");
  lines.push(`Total Revenue,GH₵${analytics.totalRevenue.toFixed(2)}`);
  lines.push(`Total Orders,${analytics.totalOrders}`);
  lines.push(`Total Products,${analytics.totalProducts}`);
  lines.push(`Total Customers,${analytics.totalCustomers}`);
  lines.push("");

  // Payment Statistics
  lines.push("Payment Statistics");
  lines.push(`Successful Payments,${analytics.successfulPayments}`);
  lines.push(`Failed Payments,${analytics.failedPayments}`);
  lines.push(`Refunded Orders,${analytics.refundedOrders}`);
  lines.push("");

  // Orders by Status
  lines.push("Orders by Status");
  lines.push("Status,Count");
  Object.entries(analytics.ordersByStatus).forEach(([status, count]) => {
    lines.push(`${status},${count}`);
  });
  lines.push("");

  // Revenue by Month
  lines.push("Revenue by Month");
  lines.push("Month,Revenue");
  analytics.revenueByMonth.forEach(({ month, revenue }) => {
    lines.push(`${month},GH₵${revenue.toFixed(2)}`);
  });
  lines.push("");

  // Payment Method Breakdown
  lines.push("Payment Method Breakdown");
  lines.push("Method,Orders,Revenue");
  analytics.paymentMethodStats.forEach(({ method, count, revenue }) => {
    lines.push(`${method},${count},GH₵${revenue.toFixed(2)}`);
  });
  lines.push("");

  // Top Products
  lines.push("Top Selling Products");
  lines.push("Product,Units Sold");
  analytics.topProducts.forEach(({ name, sold }) => {
    lines.push(`"${name}",${sold}`);
  });

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `sales-analytics-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (analytics: AnalyticsData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Sales Analytics Report", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Summary Cards
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, yPos);
  yPos += 8;

  const summaryData = [
    ["Total Revenue", `GH₵${analytics.totalRevenue.toFixed(2)}`],
    ["Total Orders", analytics.totalOrders.toString()],
    ["Total Products", analytics.totalProducts.toString()],
    ["Total Customers", analytics.totalCustomers.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: summaryData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Payment Statistics
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Statistics", 14, yPos);
  yPos += 8;

  const paymentStatsData = [
    ["Successful Payments", analytics.successfulPayments.toString()],
    ["Failed Payments", analytics.failedPayments.toString()],
    ["Refunded Orders", analytics.refundedOrders.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Status", "Count"]],
    body: paymentStatsData,
    theme: "striped",
    headStyles: { fillColor: [34, 197, 94] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Orders by Status
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Orders by Status", 14, yPos);
  yPos += 8;

  const statusData = Object.entries(analytics.ordersByStatus).map(([status, count]) => [
    status.charAt(0).toUpperCase() + status.slice(1),
    count.toString(),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Status", "Count"]],
    body: statusData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Payment Method Breakdown
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method Breakdown", 14, yPos);
  yPos += 8;

  const paymentMethodData = analytics.paymentMethodStats.map(({ method, count, revenue }) => [
    method,
    count.toString(),
    `GH₵${revenue.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Method", "Orders", "Revenue"]],
    body: paymentMethodData,
    theme: "striped",
    headStyles: { fillColor: [168, 85, 247] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Revenue by Month
  if (analytics.revenueByMonth.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Revenue by Month", 14, yPos);
    yPos += 8;

    const revenueData = analytics.revenueByMonth.map(({ month, revenue }) => [
      month,
      `GH₵${revenue.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Month", "Revenue"]],
      body: revenueData,
      theme: "striped",
      headStyles: { fillColor: [236, 72, 153] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Top Products
  if (analytics.topProducts.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Selling Products", 14, yPos);
    yPos += 8;

    const topProductsData = analytics.topProducts.map(({ name, sold }) => [
      name,
      sold.toString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Product", "Units Sold"]],
      body: topProductsData,
      theme: "striped",
      headStyles: { fillColor: [249, 115, 22] },
    });
  }

  // Save the PDF
  doc.save(`sales-analytics-${new Date().toISOString().split("T")[0]}.pdf`);
};
