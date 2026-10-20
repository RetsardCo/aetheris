import React, { useRef, useEffect } from 'react';
import { ActivityEvent } from '../../types/events';

interface AgentTraceTerminalProps {
  events: ActivityEvent[];
  onOpenFile: (filePath: string) => void;
}

export const AgentTraceTerminal: React.FC<AgentTraceTerminalProps> = ({ events, onOpenFile }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Take the last 20 events
  const recentEvents = events.slice(-20);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recentEvents.length]);

  return (
    <div className="agent-trace-dock">
      <div className="trace-dock-header">
        <span className="folder-dot" style={{ backgroundColor: 'var(--accent-green)' }}></span>
        AGENT TRACE
      </div>
      <div ref={scrollRef} className="trace-dock-body">
        {recentEvents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Waiting for agent or workspace activity...</div>
        ) : (
          recentEvents.map((e) => {
            let actionName: string = e.activityType;
            if (e.toolName) actionName = e.toolName;
            else if (e.activityType === 'file_read') actionName = 'Read';
            else if (e.activityType === 'file_write') actionName = 'Write';
            else if (e.activityType === 'file_create') actionName = 'Create';
            else if (e.activityType === 'file_delete') actionName = 'Delete';

            const target = e.filePath || e.source;

            return (
              <div
                key={e.id}
                className="trace-log-line"
                onClick={() => e.filePath && onOpenFile(e.filePath)}
                style={{ cursor: e.filePath ? 'pointer' : 'default' }}
              >
                <span className="action">{actionName}</span>
                <span className="file">({target})</span>
                {e.durationMs ? <span className="meta"> {e.durationMs}ms</span> : null}
                {e.provider !== 'unknown' ? <span className="meta"> [{e.provider}]</span> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
