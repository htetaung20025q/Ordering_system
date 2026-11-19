import { apiClient } from './client';
import { OrderResponse } from '@/types';

export interface CheckoutPayload {
  order_data: {
    order_type: string;
    qr_token?: string | null;
    table_id?: number | null;
    delivery_address?: string | null;
    special_instructions?: string | null;
    items: Array<{
      product_id: number;
      quantity: number;
      special_instructions?: string | null;
    }>;
  };
  payment_method: string;
  simulate_failure?: boolean;
}

export interface CheckoutResponse {
  message: string;
  order: OrderResponse;
  payment: {
    id: number;
    amount: number | string;
    currency: string;
    payment_method: string;
    status: string;
  };
}

export async function checkoutOrder(payload: CheckoutPayload): Promise<CheckoutResponse> {
  return apiClient<CheckoutResponse>('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchOrderById(id: number): Promise<OrderResponse> {
  return apiClient<OrderResponse>(`/orders/${id}`);
}

export async function fetchOrders(status?: string, tableId?: number): Promise<OrderResponse[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (tableId) params.append('table_id', tableId.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient<OrderResponse[]>(`/orders${query}`);
}

export async function fetchOrdersByTable(tableId: number): Promise<OrderResponse[]> {
  return apiClient<OrderResponse[]>(`/orders?table_id=${tableId}`);
}

export async function cancelOrder(id: number): Promise<OrderResponse> {
  return apiClient<OrderResponse>(`/orders/${id}/cancel`, {
    method: 'POST',
  });
}

export async function addOrderRound(
  orderId: number,
  items: Array<{ product_id: number; quantity: number; special_instructions?: string | null }>
): Promise<OrderResponse> {
  return apiClient<OrderResponse>(`/orders/${orderId}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}
