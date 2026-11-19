import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Printer,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  Users,
} from 'lucide-react';
import { RestaurantTable, OrderResponse } from '@/types';
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
  rotateTableQR,
  getTableQrUrl,
  getTableCardUrl,
} from '@/services/api/admin';
import { fetchOrdersByTable } from '@/services/api/order';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDate } from '@/utils/formatters';

export const AdminTablesPage: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);

  // Modal State
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [editTableNumber, setEditTableNumber] = useState<string>('');
  const [editTableCapacity, setEditTableCapacity] = useState<number>(4);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(false);

  const loadTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminTables();
      setTables(data);
      if (data.length > 0 && !selectedTableId) {
        setSelectedTableId(data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dining tables');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTableId]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const loadTableOrders = useCallback(async (tableId: number) => {
    try {
      const orders = await fetchOrdersByTable(tableId);
      setTableOrders(orders);
    } catch {
      setTableOrders([]);
    }
  }, []);

  useEffect(() => {
    if (selectedTableId) {
      loadTableOrders(selectedTableId);
    }
  }, [selectedTableId, loadTableOrders]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;
    setError(null);
    try {
      await createAdminTable(newTableNumber, newTableCapacity);
      setNewTableNumber('');
      await loadTables();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create table');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setError(null);
    try {
      await updateAdminTable(editingTable.id, {
        table_number: editTableNumber,
        seating_capacity: editTableCapacity,
      });
      setEditingTable(null);
      await loadTables();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update table');
    }
  };

  const handleDeleteTable = async () => {
    if (!tableToDelete) return;
    setError(null);
    try {
      await deleteAdminTable(tableToDelete.id);
      if (selectedTableId === tableToDelete.id) {
        setSelectedTableId(null);
        setTableOrders([]);
      }
      setTableToDelete(null);
      await loadTables();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete table');
    }
  };

  const handleRotateQR = async (tableId: number) => {
    if (!confirm('Rotate QR token? Previously printed tabletop stands will immediately be invalidated.')) return;
    setIsRotating(true);
    setError(null);
    try {
      await rotateTableQR(tableId);
      await loadTables();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rotate QR');
    } finally {
      setIsRotating(false);
    }
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tables & QR Stand Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dining tables, rotate security tokens, and export high-resolution branded tabletop stand cards
          </p>
        </div>

        <button
          onClick={loadTables}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-50 transition shadow-2xs self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Tables</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-3xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create New Table Form */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
          Create New Dining Table
        </h3>
        <form onSubmit={handleCreateTable} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="e.g. Table VIP-01"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            required
            className="flex-1 w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
          />
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 border border-slate-200">
            <Users className="w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="1"
              max="50"
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(parseInt(e.target.value, 10))}
              className="w-12 bg-transparent text-xs text-slate-900 font-bold text-center focus:outline-none"
              title="Guest Capacity"
            />
            <span className="text-xs text-slate-500 font-medium pr-1">Guests</span>
          </div>
          <Button type="submit" variant="primary" size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Table</span>
          </Button>
        </form>
      </div>

      {/* Two Column Layout: Tables List & Selected Table Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tables Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              All Restaurant Tables ({tables.length})
            </h3>
            <span className="text-[11px] text-slate-400">Select to inspect & export</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                className={`p-4 rounded-3xl border cursor-pointer transition select-none space-y-2.5 ${
                  selectedTableId === t.id
                    ? 'bg-white border-black shadow-md ring-1 ring-black'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{t.table_number}</span>
                    <span className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTable(t);
                        setEditTableNumber(t.table_number);
                        setEditTableCapacity(t.seating_capacity);
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-black transition"
                      title="Edit Table"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableToDelete(t);
                      }}
                      className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                      title="Delete Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Capacity: {t.seating_capacity} guests</span>
                  {(t.active_orders_count ?? 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                      {t.active_orders_count} active orders
                    </span>
                  ) : (
                    <span className="text-slate-400">Idle</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Selected Table Stand Card Preview & Actions (5 cols) */}
        <div className="lg:col-span-5">
          {selectedTable ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-lg text-slate-900">{selectedTable.table_number}</h3>
                  <p className="text-xs text-slate-500">Table Stand Card & Actions</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={getTableCardUrl(selectedTable.id)}
                    download={`table_${selectedTable.table_number.toLowerCase().replace(/\s+/g, '_')}_qr_card.png`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black text-white hover:bg-slate-800 text-xs font-bold transition shadow-xs"
                    title="Download high-resolution composite card"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Card PNG</span>
                  </a>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                    title="Print tabletop tent card"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => handleRotateQR(selectedTable.id)}
                    disabled={isRotating}
                    className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-amber-600 transition"
                    title="Rotate QR Token"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Printable Table Stand Card Preview */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex flex-col items-center">
                <div
                  id="table-stand-card"
                  className="w-full max-w-[320px] bg-white rounded-3xl p-6 border-2 border-slate-900 shadow-md text-center space-y-3.5"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black tracking-widest text-slate-900 uppercase">
                      FLOW-SYS BISTRO
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Contactless Dining & Ordering
                    </div>
                  </div>

                  <div className="bg-black text-white py-2.5 px-4 rounded-2xl shadow-xs">
                    <div className="text-base font-black tracking-tight">
                      {selectedTable.table_number.toUpperCase().startsWith('TABLE')
                        ? selectedTable.table_number.toUpperCase()
                        : `TABLE ${selectedTable.table_number.toUpperCase()}`}
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Capacity: {selectedTable.seating_capacity} Guests
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-2xl inline-block shadow-2xs">
                    <img
                      src={getTableQrUrl(selectedTable.id, 'png')}
                      alt={`QR Code for ${selectedTable.table_number}`}
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-0.5">
                    <div className="text-[10px] font-black uppercase text-slate-900 tracking-wide">
                      How to Order from Your Phone
                    </div>
                    <div className="text-[9px] text-slate-600">
                      1. Open Camera &bull; 2. Scan QR &bull; 3. Order & Pay
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase pt-0.5">
                    Opaque QR Authenticated &bull; Table Stand
                  </div>
                </div>
              </div>

              {/* Orders for this Table */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Live Orders at {selectedTable.table_number} ({tableOrders.length})
                </span>
                {tableOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No active orders placed yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {tableOrders.map((o) => (
                      <div
                        key={o.id}
                        className="p-2.5 rounded-2xl bg-slate-50 text-xs flex items-center justify-between border border-slate-100"
                      >
                        <div>
                          <span className="font-bold text-slate-900">#{o.order_number}</span>
                          <span className="text-[10px] text-slate-500 block">{formatDate(o.created_at)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{formatCurrency(o.total_amount)}</span>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400 text-xs">
              Select a table from the list to view stand card preview.
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900">Edit {editingTable.table_number}</h3>
              <button onClick={() => setEditingTable(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Table Name</label>
                <input
                  type="text"
                  value={editTableNumber}
                  onChange={(e) => setEditTableNumber(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (Guests)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editTableCapacity}
                  onChange={(e) => setEditTableCapacity(parseInt(e.target.value, 10))}
                  required
                  className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {tableToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">Delete {tableToDelete.table_number}?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 text-[11px] text-slate-600 border border-slate-100">
              Note: If this table has active customer dining sessions, deletion will be blocked by backend security.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTableToDelete(null)}
                className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTable}
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
