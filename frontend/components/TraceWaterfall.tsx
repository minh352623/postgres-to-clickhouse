'use client';

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

interface TraceWaterfallProps {
  spans: Span[];
}

const SERVICE_COLORS: Record<string, string> = {
  'order-service': 'bg-blue-500',
  'payment-service': 'bg-green-500',
  'frontend': 'bg-purple-500',
};

export default function TraceWaterfall({ spans }: TraceWaterfallProps) {
  if (spans.length === 0) {
    return <div className="text-center text-gray-500 py-8">No spans to display</div>;
  }

  // Calculate timeline
  const startTime = new Date(spans[0].Timestamp).getTime();
  const endTime = new Date(spans[spans.length - 1].Timestamp).getTime() + (spans[spans.length - 1].Duration / 1000000);
  const totalDuration = endTime - startTime;

  return (
    <div className="space-y-2">
      {spans.map((span) => {
        const spanStart = new Date(span.Timestamp).getTime();
        const spanDuration = span.Duration / 1000000; // Convert nanoseconds to milliseconds
        const offset = ((spanStart - startTime) / totalDuration) * 100;
        const width = (spanDuration / totalDuration) * 100;
        const isError = span.StatusCode === 'ERROR';

        return (
          <div
            key={span.SpanId}
            className="relative group hover:bg-white/5 p-2 rounded transition-colors"
          >
            <div className="flex items-start gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SERVICE_COLORS[span.ServiceName] || 'bg-gray-500'} text-white`}>
                    {span.ServiceName}
                  </span>
                  <span className="text-sm text-gray-300 truncate">{span.SpanName}</span>
                  {isError && (
                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                      ERROR
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {spanDuration.toFixed(2)}ms
                </div>
              </div>
            </div>

            {/* Timeline bar */}
            <div className="h-6 bg-black/40 rounded-lg overflow-hidden relative">
              <div
                className={`h-full ${isError ? 'bg-red-500' : SERVICE_COLORS[span.ServiceName] || 'bg-gray-500'} opacity-80 hover:opacity-100 transition-opacity`}
                style={{
                  marginLeft: `${offset}%`,
                  width: `${Math.max(width, 0.5)}%`,
                }}
              ></div>
            </div>

            {/* Tooltip on hover */}
            <div className="hidden group-hover:block absolute z-10 left-0 top-full mt-1 p-3 bg-black/90 border border-white/20 rounded-lg text-xs min-w-[300px]">
              <div className="space-y-1">
                <div><span className="text-gray-400">Service:</span> {span.ServiceName}</div>
                <div><span className="text-gray-400">Operation:</span> {span.SpanName}</div>
                <div><span className="text-gray-400">Duration:</span> {spanDuration.toFixed(2)}ms</div>
                <div><span className="text-gray-400">Status:</span> {span.StatusCode}</div>
                {span.StatusMessage && <div><span className="text-gray-400">Message:</span> {span.StatusMessage}</div>}
                <div className="text-[10px] text-gray-500 mt-2">
                  Span: {span.SpanId.slice(0, 16)}...
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
