import { OrderResponse } from '@/types';
import { fetchOrderById } from '../api/order';

export type OrderUpdateCallback = (order: OrderResponse) => void;

export class OrderRealtimeService {
  private orderId: number;
  private onUpdate: OrderUpdateCallback;
  private pollTimer: number | null = null;
  private isDestroyed: boolean = false;
  private pollIntervalMs: number = 3500;

  constructor(orderId: number, onUpdate: OrderUpdateCallback) {
    this.orderId = orderId;
    this.onUpdate = onUpdate;
    this.startSmartPolling();
  }

  private startSmartPolling(): void {
    const poll = async () => {
      if (this.isDestroyed) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // Pause polling when tab is hidden to save battery and network
        this.pollTimer = window.setTimeout(poll, this.pollIntervalMs);
        return;
      }
      try {
        const order = await fetchOrderById(this.orderId);
        if (!this.isDestroyed) {
          this.onUpdate(order);
          // Stop polling if order reached terminal state
          if (['completed', 'picked_up', 'cancelled'].includes(order.status)) {
            return;
          }
        }
      } catch {
        // Silently retry on transient network hiccup
      }
      if (!this.isDestroyed) {
        this.pollTimer = window.setTimeout(poll, this.pollIntervalMs);
      }
    };

    // Initial immediate fetch
    poll();
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
