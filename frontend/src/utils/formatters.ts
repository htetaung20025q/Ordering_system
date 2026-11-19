export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0 MMK';
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  return `${new Intl.NumberFormat('en-US').format(Math.round(numeric))} MMK`;
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function calculateBill(subtotal: number) {
  const tax = Math.round(subtotal * 0.05); // 5% Commercial Tax
  const service = Math.round(subtotal * 0.10); // 10% Service Charge
  const total = subtotal + tax + service;
  return {
    subtotal,
    tax,
    service,
    total,
  };
}
