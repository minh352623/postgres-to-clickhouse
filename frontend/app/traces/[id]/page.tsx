'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';

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

export default function TraceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: traceId } = use(params);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSpan, setExpandedSpan] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTraceSpans();
  }, [traceId]);

  const fetchTraceSpans = async () => {
    try {
      const res = await fetch(`/api/traces?traceId=${traceId}`);
      const data = await res.json();
      setSpans(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trace spans:', error);
      setLoading(false);
    }
  };

  const handleCopyTraceId = () => {
    navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400 animate-pulse">Loading trace details...</p>
        </div>
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500">Trace not found</p>
            <Link href="/traces" className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block">
              ← Back to traces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate trace metrics
  const rootSpan = spans.find(s => !s.ParentSpanId || s.ParentSpanId === '');
  const startTime = new Date(spans[0].Timestamp).getTime();
  const endTime = new Date(spans[spans.length - 1].Timestamp).getTime();
  const totalDuration = ((endTime - startTime) / 1000000).toFixed(2);
  const services = [...new Set(spans.map(s => s.ServiceName))];
  const hasErrors = spans.some(s => s.StatusCode === 'ERROR');

  // Build service flow
  const serviceFlow = spans.reduce((acc, span) => {
    if (!acc.find(s => s.name === span.ServiceName)) {
      acc.push({
        name: span.ServiceName,
        spanCount: spans.filter(s => s.ServiceName === span.ServiceName).length,
        hasError: spans.filter(s => s.ServiceName === span.ServiceName).some(s => s.StatusCode === 'ERROR'),
      });
    }
    return acc;
  }, [] as { name: string; spanCount: number; hasError: boolean }[]);

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
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/traces" className="text-gray-400 hover:text-white transition-colors">
                ←
              </Link>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-300">
                Trace Details
              </h1>
              {hasErrors && (
                <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-semibold">
                  ERROR
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-gray-500">{traceId}</p>
              <button
                onClick={handleCopyTraceId}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors flex items-center gap-1"
                title="Copy Trace ID"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>⏱️ {totalDuration}ms</span>
              <span>📦 {spans.length} spans</span>
              <span>🔧 {services.length} services</span>
              <span>🕐 {new Date(spans[0].Timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Service Flow Diagram */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">🔄 Service Flow</h3>
          <div className="flex items-center gap-4 overflow-x-auto pb-4">
            {serviceFlow.map((service, idx) => (
              <div key={service.name} className="flex items-center gap-4">
                <div className={`px-6 py-4 rounded-xl border-2 min-w-[180px] ${
                  service.hasError 
                    ? 'bg-red-900/20 border-red-500/50' 
                    : 'bg-indigo-900/20 border-indigo-500/50'
                }`}>
                  <div className="text-xs text-gray-400 mb-1">Service</div>
                  <div className="font-semibold text-white">{service.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{service.spanCount} span{service.spanCount > 1 ? 's' : ''}</div>
                </div>
                {idx < serviceFlow.length - 1 && (
                  <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Span Timeline */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">📊 Span Timeline</h3>
          <div className="space-y-2">
            {spans.map((span, idx) => {
              const spanStart = new Date(span.Timestamp).getTime();
              const offset = ((spanStart - startTime) / (endTime - startTime)) * 100;
              const width = ((span.Duration / 1000000) / parseFloat(totalDuration)) * 100;
              const isError = span.StatusCode === 'ERROR';
              const isExpanded = expandedSpan === span.SpanId;
              const depth = spans.filter(s => 
                s.ParentSpanId && span.SpanId !== s.SpanId && 
                new Date(s.Timestamp).getTime() < spanStart
              ).length;

              return (
                <div key={span.SpanId} style={{ marginLeft: `${depth * 20}px` }}>
                  <button
                    onClick={() => setExpandedSpan(isExpanded ? null : span.SpanId)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isError 
                        ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900/20' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-200">{span.SpanName}</span>
                            <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-gray-400">
                              {span.ServiceName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(span.Duration / 1000000).toFixed(2)}ms · {span.StatusCode}
                            {span.StatusMessage && ` · ${span.StatusMessage}`}
                          </div>
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
                    
                    {/* Timeline bar */}
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isError ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ 
                          marginLeft: `${offset}%`, 
                          width: `${Math.max(width, 1)}%` 
                        }}
                      ></div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 p-4 rounded-lg bg-black/40 border border-white/10 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500 mb-1">Span ID</p>
                          <p className="font-mono text-gray-300">{span.SpanId.slice(0, 24)}...</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Parent Span ID</p>
                          <p className="font-mono text-gray-300">{span.ParentSpanId?.slice(0, 24) || 'Root'}</p>
                        </div>
                      </div>

                      {/* Span Attributes */}
                      {span.SpanAttributes && Object.keys(span.SpanAttributes).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">📋 Attributes</p>
                          <div className="bg-black/40 rounded p-3 text-xs">
                            {Object.entries(span.SpanAttributes).map(([key, value]) => (
                              <div key={key} className="flex justify-between py-1">
                                <span className="text-gray-500">{key}:</span>
                                <span className="text-gray-300 ml-2">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resource Attributes */}
                      {span.ResourceAttributes && Object.keys(span.ResourceAttributes).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">🏷️ Resource</p>
                          <div className="bg-black/40 rounded p-3 text-xs">
                            {Object.entries(span.ResourceAttributes).map(([key, value]) => (
                              <div key={key} className="flex justify-between py-1">
                                <span className="text-gray-500">{key}:</span>
                                <span className="text-gray-300 ml-2">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
