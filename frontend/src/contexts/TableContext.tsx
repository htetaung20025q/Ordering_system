import React, { createContext, useContext, useState, useEffect } from 'react';
import { RestaurantTable } from '@/types';
import { resolveTableByToken } from '@/services/api/menu';

interface TableContextType {
  table: RestaurantTable | null;
  qrToken: string | null;
  isLoading: boolean;
  error: string | null;
  setManualTable: (table: RestaurantTable, token: string) => void;
  clearTable: () => void;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

const TABLE_STORAGE_KEY = 'flowsys_active_table';
const TOKEN_STORAGE_KEY = 'flowsys_active_qr_token';

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [table, setTable] = useState<RestaurantTable | null>(() => {
    try {
      const stored = localStorage.getItem(TABLE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [qrToken, setQrToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL parameters for ?token= or ?table=
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || params.get('table');

    if (tokenFromUrl && tokenFromUrl !== qrToken) {
      setIsLoading(true);
      setError(null);
      resolveTableByToken(tokenFromUrl)
        .then((resolved) => {
          setTable(resolved);
          setQrToken(resolved.qr_token);
          localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(resolved));
          localStorage.setItem(TOKEN_STORAGE_KEY, resolved.qr_token);
        })
        .catch((err) => {
          setError(err.detail || 'Invalid or expired table QR token');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [qrToken]);

  const setManualTable = (newTable: RestaurantTable, token: string) => {
    setTable(newTable);
    setQrToken(token);
    localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(newTable));
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  };

  const clearTable = () => {
    setTable(null);
    setQrToken(null);
    localStorage.removeItem(TABLE_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  };

  return (
    <TableContext.Provider
      value={{
        table,
        qrToken,
        isLoading,
        error,
        setManualTable,
        clearTable,
      }}
    >
      {children}
    </TableContext.Provider>
  );
};

export const useTable = (): TableContextType => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
};
