'use client';

import { useState, useEffect, useCallback } from 'react';

interface OrderWithItems {
  id: string;
  externalCode: string | null;
  storeName: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  batchId: string;
  status: string;
  createdAt: string;
  items: {
    id: string;
    skuCode: string;
    skuName: string;
    quantity: number;
    spec: string | null;
    remark: string | null;
  }[];
}

export function OrderList() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [externalCode, setExternalCode] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
        ...(externalCode && { externalCode }),
      });
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders);
        setTotal(data.data.total);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, externalCode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="fade-in">
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-4 mb-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索收件人姓名或门店..."
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary flex-1"
          />
          <input
            type="text"
            value={externalCode}
            onChange={e => { setExternalCode(e.target.value); setPage(1); }}
            placeholder="外部编码..."
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-48"
          />
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p className="text-lg mb-2">暂无运单记录</p>
            <p className="text-sm">提交订单后将在此显示</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary-light">
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">外部编码</th>
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">收货门店</th>
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">收件人</th>
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">电话</th>
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">物品数</th>
                    <th className="px-4 py-3 text-left text-primary-text font-semibold whitespace-nowrap">提交时间</th>
                    <th className="px-4 py-3 text-center text-primary-text font-semibold whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <>
                      <tr key={order.id} className="border-b border-border/50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-text">{order.externalCode || '-'}</td>
                        <td className="px-4 py-3 text-text">{order.storeName || '-'}</td>
                        <td className="px-4 py-3 text-text">{order.receiverName || '-'}</td>
                        <td className="px-4 py-3 text-text">{order.receiverPhone || '-'}</td>
                        <td className="px-4 py-3 text-text">{order.items?.length || 0}</td>
                        <td className="px-4 py-3 text-text-muted text-xs">
                          {new Date(order.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedOrderId(
                              expandedOrderId === order.id ? null : order.id
                            )}
                            className="text-primary text-xs hover:underline"
                          >
                            {expandedOrderId === order.id ? '收起' : '详情'}
                          </button>
                        </td>
                      </tr>
                      {expandedOrderId === order.id && (
                        <tr key={`${order.id}-detail`}>
                          <td colSpan={7} className="px-6 py-3 bg-gray-50">
                            <div className="mb-2">
                              <span className="text-xs text-text-muted">地址: </span>
                              <span className="text-sm text-text">{order.receiverAddress || '-'}</span>
                            </div>
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-white">
                                  <th className="px-2 py-1.5 text-left text-primary-text">SKU编码</th>
                                  <th className="px-2 py-1.5 text-left text-primary-text">SKU名称</th>
                                  <th className="px-2 py-1.5 text-right text-primary-text">数量</th>
                                  <th className="px-2 py-1.5 text-left text-primary-text">规格</th>
                                  <th className="px-2 py-1.5 text-left text-primary-text">备注</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items?.map(item => (
                                  <tr key={item.id} className="border-t border-border/30">
                                    <td className="px-2 py-1">{item.skuCode}</td>
                                    <td className="px-2 py-1">{item.skuName}</td>
                                    <td className="px-2 py-1 text-right">{item.quantity}</td>
                                    <td className="px-2 py-1">{item.spec || '-'}</td>
                                    <td className="px-2 py-1">{item.remark || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-text-muted">
                共 {total} 条记录，第 {page}/{totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border border-border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border border-border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
