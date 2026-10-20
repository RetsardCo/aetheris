import React, { useState } from 'react';
import { ActivityEvent, SessionRecord } from '../../types/events';

interface SessionViewProps {
  sessions: SessionRecord[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onExportSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export const SessionView: React.FC<SessionViewProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onExportSession,
  onDeleteSession
}) => {
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  return (
    <div className="tab-full-view">
      <div className="section-header">Persistent Session History & Replay</div>

      {/* Replay Controls Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>Event Replay Console</span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Replays recorded events step-by-step into the constellation map and trace stream.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Speed:</span>
            {[0.5, 1, 2, 5].map((speed) => (
              <button
                key={speed}
                className="view-tab-btn"
                style={{
                  backgroundColor: replaySpeed === speed ? 'var(--accent-cyan)' : 'transparent',
                  color: replaySpeed === speed ? '#000' : 'var(--text-secondary)'
                }}
                onClick={() => setReplaySpeed(speed)}
              >
                {speed}x
              </button>
            ))}

            <button
              className="view-tab-btn"
              style={{
                backgroundColor: isReplaying ? 'var(--accent-amber)' : 'var(--accent-green)',
                color: '#000',
                fontWeight: 600
              }}
              onClick={() => setIsReplaying(!isReplaying)}
            >
              {isReplaying ? 'Pause Replay' : 'Start Replay'}
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>0</span>
          <input
            type="range"
            min="0"
            max="100"
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>100%</span>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="card-title" style={{ marginTop: 10 }}>Recorded Workspace Sessions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No recorded sessions in SQLite storage yet.
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const startTimeStr = new Date(s.startTime).toLocaleString();
            return (
              <div
                key={s.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${isCurrent ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{s.workspaceName || 'Workspace'}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {s.id}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 10,
                          backgroundColor: 'rgba(6, 182, 212, 0.2)',
                          color: 'var(--accent-cyan)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        CURRENT ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Started: {startTimeStr} • Status: {s.recordingStatus}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      gap: 16,
                      fontFamily: 'var(--font-mono)',
                      marginTop: 2
                    }}
                  >
                    <span>Events: {s.totalEvents}</span>
                    <span>Files Touched: {s.filesTouched}</span>
                    <span>Tool Calls: {s.toolCalls}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="view-tab-btn"
                    style={{ backgroundColor: '#1e293b', color: '#fff' }}
                    onClick={() => onSelectSession(s.id)}
                  >
                    Load
                  </button>
                  <button
                    className="view-tab-btn"
                    style={{ backgroundColor: '#1e293b', color: '#fff' }}
                    onClick={() => onExportSession(s.id)}
                  >
                    Export JSON
                  </button>
                  {!isCurrent && (
                    <button
                      className="view-tab-btn"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' }}
                      onClick={() => onDeleteSession(s.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
