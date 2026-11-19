import { apiClient } from './client';
import { KitchenTicketResponse, OrderResponse } from '@/types';

export async function fetchKDSTickets(activeOnly: boolean = true): Promise<KitchenTicketResponse[]> {
  const query = activeOnly ? '?active_only=true' : '';
  return apiClient<KitchenTicketResponse[]>(`/kds/tickets${query}`);
}

export async function updateKDSTicketStatus(ticketId: number, status: string): Promise<KitchenTicketResponse> {
  return apiClient<KitchenTicketResponse>(`/kds/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function dismissKDSTicket(ticketId: number): Promise<void> {
  return apiClient<void>(`/kds/tickets/${ticketId}`, {
    method: 'DELETE',
  });
}

export async function executeChefOrderAction(
  orderId: number,
  action: 'accept' | 'confirm' | 'prepare' | 'cook' | 'ready' | 'pickup'
): Promise<{
  message: string;
  order_id: number;
  status: string;
  voucher_number?: string;
  preparation_due_at?: string | null;
  preparation_duration_seconds?: number | null;
}> {
  return apiClient(`/kds/orders/${orderId}/${action}`, {
    method: 'POST',
  });
}

export async function fetchReadyOrders(): Promise<OrderResponse[]> {
  return apiClient<OrderResponse[]>('/kds/orders/ready');
}
