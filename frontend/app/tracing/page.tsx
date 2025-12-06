'use client';

import { useEffect, useState } from 'react';
import TraceWaterfall from '@/components/TraceWaterfall';
import Link from 'next/link';

interface Trace {
  TraceId: string;
  Start: string;
  End: string;
  span_count: number;
  total_duration_ms: number;
  has_errors: number;
  services: string[];
  user_id: string;
}

interface Span {
  Timestamp: string;
  TraceId: string;
  SpanId: string;
  ParentSpanId: string;
  SpanName: string;
  SpanKind: string;
  ServiceName: string;
  ResourceAttributes: Record<string, string>;
  SpanAttributes: Record<string, string>;
  Duration: number;
  StatusCode: string;
  StatusMessage: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const SERVICE_NAMES: Record<string, string> = {
  'order-service': 'Order',
  'payment-service': 'Payment',
  'frontend': 'Frontend',
};

export default function TracingPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTraceSpans, setSelectedTraceSpans] = useState<Span[]>([]);
  const [loadingSpans, setLoadingSpans] = useState(false);
  const [expandedSpanId, setExpandedSpanId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Filter states
  const [userFilter, setUserFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  useEffect(() => {
    fetchTraces();
  }, [userFilter, serviceFilter, pagination.page]);

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

  const fetchTraceSpans = async (traceId: string) => {
    setLoadingSpans(true);
    try {
      const res = await fetch(`/api/traces?traceId=${traceId}`);
      const spans = await res.json();
      setSelectedTraceSpans(spans);
    } catch (error) {
      console.error('Error fetching trace spans:', error);
    } finally {
      setLoadingSpans(false);
    }
  };

  const handleTraceClick = (traceId: string) => {
    if (selectedTraceId === traceId) {
      setSelectedTraceId(null);
      setSelectedTraceSpans([]);
      setExpandedSpanId(null);
    } else {
      setSelectedTraceId(traceId);
      fetchTraceSpans(traceId);
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
              Distributed Tracing
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Monitor request flows across microservices
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
                <option value="1">Frontend</option>
                <option value="2">Order</option>
                <option value="3">Payment</option>
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
              <div className="space-y-4 mb-6">
                {traces.map((trace) => {
                  const isSelected = selectedTraceId === trace.TraceId;
                  const hasErrors = trace.has_errors === 0;
                  
                  // Safety check
                  if (!trace.TraceId) return null;

                  return (
                    <div key={trace.TraceId} className="space-y-2">
                      <button
                        onClick={() => handleTraceClick(trace.TraceId)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          hasErrors 
                            ? 'bg-red-900/20 border-red-500/30 hover:bg-red-900/30' 
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-mono text-gray-300">
                                  {trace.TraceId.slice(0, 24)}...
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
                              <p className="text-xs text-gray-500 mt-1">
                                {trace.span_count} spans · {trace.total_duration_ms.toFixed(0)}ms · {trace.services.map(s => SERVICE_NAMES[s] || s).join(', ')}
                                {trace.user_id && trace.user_id !== '' && ` · User: ${trace.user_id.slice(0, 8)}...`}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(trace.Start).toLocaleString()}
                          </div>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="p-6 rounded-xl bg-black/40 border border-white/5 space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-4">Trace Waterfall</h3>
                            {loadingSpans ? (
                              <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                                <p className="text-gray-500 text-sm">Loading spans...</p>
                              </div>
                            ) : (
                              <TraceWaterfall spans={selectedTraceSpans} />
                            )}
                          </div>

                          {/* Span Details with Error Logs */}
                          {!loadingSpans && selectedTraceSpans.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-300 mb-4">📋 Span Details</h3>
                              <div className="space-y-2">
                                {selectedTraceSpans.map((span) => {
                                  const isError = span.StatusCode === 'ERROR';
                                  const isExpanded = expandedSpanId === span.SpanId;
                                  
                                  return (
                                    <div 
                                      key={span.SpanId}
                                      className={`rounded-lg border ${
                                        isError 
                                          ? 'bg-red-900/10 border-red-500/30' 
                                          : 'bg-white/5 border-white/10'
                                      }`}
                                    >
                                      <button
                                        onClick={() => setExpandedSpanId(isExpanded ? null : span.SpanId)}
                                        className="w-full p-3 text-left hover:bg-white/5 transition-colors rounded-lg"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                            <div>
                                              <p className="text-xs font-medium text-gray-300">
                                                {span.ServiceName} · {span.SpanName}
                                              </p>
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                Status: {span.StatusCode} · {(span.Duration / 1000000).toFixed(2)}ms
                                              </p>
                                            </div>
                                          </div>
                                          <svg 
                                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                            fill="none" 
                                            viewBox="0 0 24 24" 
                                            stroke="currentColor"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </div>
                                      </button>

                                      {isExpanded && (
                                        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
                                          <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                              <p className="text-gray-500 mb-1">Span ID</p>
                                              <p className="font-mono text-gray-300">{span.SpanId.slice(0, 16)}...</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500 mb-1">Parent Span ID</p>
                                              <p className="font-mono text-gray-300">{span.ParentSpanId?.slice(0, 16) || 'Root'}</p>
                                            </div>
                                          </div>

                                          {/* Span Attributes */}
                                          {span.SpanAttributes && Object.keys(span.SpanAttributes).length > 0 && (
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">� Span Attributes</p>
                                              <pre className="bg-black/40 rounded p-2 text-xs text-gray-300 overflow-x-auto">
                                                {JSON.stringify(span.SpanAttributes, null, 2)}
                                              </pre>
                                            </div>
                                          )}

                                          {/* Resource Attributes */}
                                          {span.ResourceAttributes && Object.keys(span.ResourceAttributes).length > 0 && (
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">🏷️ Resource Attributes</p>
                                              <pre className={`rounded p-2 text-xs overflow-x-auto ${
                                                isError ? 'bg-red-900/20 text-red-300' : 'bg-black/40 text-gray-300'
                                              }`}>
                                                {JSON.stringify(span.ResourceAttributes, null, 2)}
                                              </pre>
                                            </div>
                                          )}

                                          {/* Status Message */}
                                          {span.StatusMessage && (
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1">💬 Status Message</p>
                                              <pre className={`rounded p-2 text-xs overflow-x-auto ${
                                                isError ? 'bg-red-900/20 text-red-300' : 'bg-black/40 text-gray-300'
                                              }`}>
                                                {span.StatusMessage}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
