import React from 'react';
import { ActivityEvent } from '../../types/events';

interface TraceCardsProps {
  events: ActivityEvent[];
  onOpenFile: (filePath: string) => void;
}

export const TraceCards: React.FC<TraceCardsProps> = ({ events, onOpenFile }) => {
  // Take last 4 events with relevant file or tool info
  const relevantEvents = events
    .filter((e) => e.filePath || e.toolName || e.codeSnippet)
    .slice(-4)
    .reverse();

  if (relevantEvents.length === 0) {
    return null;
  }

  return (
    <div className="right-trace-stack">
      {relevantEvents.map((evt) => {
        const title = evt.filePath || evt.toolName || 'agent_action';
        const borderColor =
          evt.activityType === 'file_write'
            ? 'var(--accent-amber)'
            : evt.activityType === 'file_create'
            ? 'var(--accent-green)'
            : 'var(--border-accent-cyan)';

        let snippetText = evt.codeSnippet;
        if (!snippetText) {
          if (evt.activityType === 'file_read') {
            snippetText = `$ cat ${title}\n// reading file contents\n// ...`;
          } else if (evt.activityType === 'file_write') {
            snippetText = `$ git diff ${title}\n+ modified in workspace\n// updated lines`;
          } else if (evt.toolName) {
            snippetText = `$ ${evt.toolName}(${evt.filePath || ''})\n// executed tool: ${evt.provider}`;
          } else {
            snippetText = `// activity: ${evt.activityType}`;
          }
        }

        return (
          <div
            key={evt.id}
            className="trace-card"
            style={{ borderColor }}
            onClick={() => evt.filePath && onOpenFile(evt.filePath)}
            title={evt.filePath ? `Click to open ${evt.filePath} in VS Code` : undefined}
          >
            <div className="trace-card-header">
              <div className="window-dots">
                <span className="win-dot dot-red"></span>
                <span className="win-dot dot-yellow"></span>
                <span className="win-dot dot-green"></span>
              </div>
              <span className="trace-card-title">{title}</span>
            </div>
            <div className="trace-card-body">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {snippetText}
              </pre>
              <span className="trace-card-prompt-symbol">$</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
