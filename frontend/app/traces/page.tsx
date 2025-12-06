'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Trace {
  TraceId: string;
  Start: string;
  End: string;
  total_duration_ms: number;
  span_count: number;
  has_errors: number;
  services: string[];
  user_id: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function TracesListPage() {
  const router = useRouter();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTraces();
  }, [pagination.page, userFilter, serviceFilter]);

  const fetchTraces = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      if (userFilter) params.append('userId', userFilter);
      if (serviceFilter) params.append('serviceName', serviceFilter);

      const res = await fetch(`/api/traces?${params.toString()}`);
      const data = await res.json();
      setTraces(data.traces || []);
      setPagination(data.pagination || pagination);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching traces:', error);
      setLoading(false);
    }
  };

  const handleCopyTraceId = (traceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(traceId);
    setCopiedId(traceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    setLoading(true);
    fetchTraces();
  };

  const handleClearFilters = () => {
    setUserFilter('');
    setServiceFilter('');
    setPagination({ ...pagination, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPagination({ ...pagination, page: newPage });
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && traces.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400 animate-pulse">Loading traces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-300">
              📊 Distributed Traces
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              OpenTelemetry trace monitoring & visualization
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Search Filters */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">🔍 Filter Traces</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">User ID</label>
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Enter user ID..."
                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Service</label>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Services</option>
                <option value="order-service">Order Service</option>
                <option value="payment-service">Payment Service</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium"
              >
                Search
              </button>
              {(userFilter || serviceFilter) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Trace List */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-200">
              {userFilter || serviceFilter ? 'Filtered Traces' : 'Recent Traces'}
            </h2>
            <span className="text-sm text-gray-500">
              {pagination.total} total · Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>

          {traces.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {userFilter || serviceFilter
                ? 'No traces found matching your filters.'
                : 'No traces found. Make some requests to generate trace data.'}
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {traces.map((trace) => {
                  const hasErrors = trace.has_errors === 0;
                  const duration = trace.total_duration_ms.toFixed(2);
                  
                  // Safety check for TraceId
                  if (!trace.TraceId) return null;

                  return (
                    <button
                      key={trace.TraceId}
                      onClick={() => router.push(`/traces/${trace.TraceId}`)}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.01] ${
                        hasErrors
                          ? 'bg-red-900/20 border-red-500/30 hover:bg-red-900/30'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-mono text-gray-300">
                                {trace.TraceId.slice(0, 32)}...
                              </p>
                              <button
                                onClick={(e) => handleCopyTraceId(trace.TraceId, e)}
                                className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                                title="Copy Trace ID"
                              >
                                {copiedId === trace.TraceId ? (
                                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                              {hasErrors && (
                                <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-semibold">
                                  ERROR
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>⏱️ {duration}ms</span>
                              <span>📦 {trace.span_count} spans</span>
                              <span>🔧 {trace.services.join(', ')}</span>
                              {trace.user_id && trace.user_id !== '' && <span>👤 {trace.user_id.slice(0, 8)}...</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-gray-500 text-right">
                            {new Date(trace.Start).toLocaleString()}
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                            pagination.page === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
