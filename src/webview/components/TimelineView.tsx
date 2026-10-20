import React, { useState, useMemo } from 'react';
import { ActivityEvent, ActivityType, Provider } from '../../types/events';

interface TimelineViewProps {
  events: ActivityEvent[];
  onOpenFile: (path: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ events, onOpenFile }) => {
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterProvider !== 'all' && e.provider !== filterProvider) return false;
      if (filterType !== 'all' && e.activityType !== filterType) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchesPath = e.filePath?.toLowerCase().includes(q);
        const matchesTool = e.toolName?.toLowerCase().includes(q);
        if (!matchesPath && !matchesTool) return false;
      }
      return true;
    });
  }, [events, filterProvider, filterType, query]);

  return (
    <div className="tab-full-view">
      <div className="section-header">Chronological Activity Timeline</div>

      {/* Filter Controls Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Filter by path or tool..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 12px',
            borderRadius: 6,
            width: 240
          }}
        />

        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '6px 10px',
            borderRadius: 6
          }}
        >
          <option value="all">All Providers</option>
          <option value="copilot">GitHub Copilot</option>
          <option value="antigravity">Google Antigravity</option>
          <option value="vscode">VS Code</option>
          <option value="unknown">Other Ingest</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '6px 10px',
            borderRadius: 6
          }}
        >
          <option value="all">All Activity Types</option>
          <option value="tool_call">Tool Calls</option>
          <option value="tool_result">Tool Results</option>
          <option value="file_read">File Reads</option>
          <option value="file_write">File Writes</option>
          <option value="file_create">File Creates</option>
          <option value="file_delete">File Deletes</option>
        </select>

        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Showing {filteredEvents.length} of {events.length} events
        </span>
      </div>

      {/* Timeline Stream */}
      <div className="timeline-stream">
        {filteredEvents.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching events found.
          </div>
        ) : (
          filteredEvents.map((e) => {
            const isExpanded = expandedId === e.id;
            const timeStr = new Date(e.timestamp).toLocaleTimeString();
            const providerClass = `provider-${e.provider}`;

            return (
              <div
                key={e.id}
                className="timeline-row"
                style={{ flexDirection: isExpanded ? 'column' : 'row', alignItems: isExpanded ? 'stretch' : 'center' }}
                onClick={() => setExpandedId(isExpanded ? null : e.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <span className="timeline-time">{timeStr}</span>
                  <span className={`timeline-provider-badge ${providerClass}`}>{e.provider}</span>

                  <div className="timeline-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="timeline-act-type">{e.activityType}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        [{e.evidenceLevel}]
                      </span>
                    </div>
                    <div
                      className="timeline-path"
                      onClick={(ev) => {
                        if (e.filePath) {
                          ev.stopPropagation();
                          onOpenFile(e.filePath);
                        }
                      }}
                      style={{ cursor: e.filePath ? 'pointer' : 'default', textDecoration: e.filePath ? 'underline' : 'none' }}
                    >
                      {e.filePath || e.toolName || e.source}
                    </div>
                  </div>

                  {e.durationMs && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {e.durationMs}ms
                    </span>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    {e.codeSnippet && (
                      <pre
                        style={{
                          backgroundColor: '#0a0f18',
                          padding: 8,
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: '#e2e8f0',
                          overflowX: 'auto'
                        }}
                      >
                        {e.codeSnippet}
                      </pre>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Metadata:
                      <pre
                        style={{
                          backgroundColor: '#0a0f18',
                          padding: 8,
                          borderRadius: 4,
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          marginTop: 4
                        }}
                      >
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
