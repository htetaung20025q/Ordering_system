import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrderResponse } from '@/types';
import { fetchOrderById } from '@/services/api/order';

interface OrderContextType {
  activeOrder: OrderResponse | null;
  recentOrders: OrderResponse[];
  setActiveOrder: (order: OrderResponse | null) => void;
  refreshActiveOrder: () => Promise<void>;
  addRecentOrder: (order: OrderResponse) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const RECENT_ORDERS_KEY = 'flowsys_recent_orders';
const ACTIVE_ORDER_ID_KEY = 'flowsys_active_order_id';

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderResponse[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_ORDERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Restore active order on startup
  useEffect(() => {
    const savedOrderId = localStorage.getItem(ACTIVE_ORDER_ID_KEY);
    if (savedOrderId) {
      const id = parseInt(savedOrderId, 10);
      if (!isNaN(id)) {
        fetchOrderById(id)
          .then((order) => {
            setActiveOrder(order);
          })
          .catch(() => {
            localStorage.removeItem(ACTIVE_ORDER_ID_KEY);
          });
      }
    }
  }, []);

  const handleSetActiveOrder = (order: OrderResponse | null) => {
    setActiveOrder(order);
    if (order) {
      localStorage.setItem(ACTIVE_ORDER_ID_KEY, order.id.toString());
      addRecentOrder(order);
    } else {
      localStorage.removeItem(ACTIVE_ORDER_ID_KEY);
    }
  };

  const addRecentOrder = (order: OrderResponse) => {
    setRecentOrders((prev) => {
      const filtered = prev.filter((o) => o.id !== order.id);
      const updated = [order, ...filtered].slice(0, 10); // Keep last 10 orders
      localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const refreshActiveOrder = async () => {
    if (!activeOrder) return;
    try {
      const fresh = await fetchOrderById(activeOrder.id);
      setActiveOrder(fresh);
      addRecentOrder(fresh);
    } catch {
      // Ignore transient error
    }
  };

  return (
    <OrderContext.Provider
      value={{
        activeOrder,
        recentOrders,
        setActiveOrder: handleSetActiveOrder,
        refreshActiveOrder,
        addRecentOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
};
