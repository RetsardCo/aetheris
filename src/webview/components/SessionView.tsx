import React, { useState, useEffect, useMemo } from 'react';
import { ActivityEvent, SessionComparisonResult, SessionRecord } from '../../types/events';

interface SessionViewProps {
  sessions: SessionRecord[];
  currentSessionId: string;
  replayEvents?: ActivityEvent[];
  comparisonResult?: SessionComparisonResult | null;
  onSelectSession: (id: string) => void;
  onExportSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onCompareSessions?: (sessionAId: string, sessionBId: string) => void;
  onReplayStep?: (event: ActivityEvent) => void;
}

export const SessionView: React.FC<SessionViewProps> = ({
  sessions,
  currentSessionId,
  replayEvents = [],
  comparisonResult,
  onSelectSession,
  onExportSession,
  onDeleteSession,
  onCompareSessions,
  onReplayStep
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(currentSessionId || (sessions[0]?.id || ''));
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Comparison State
  const [compareA, setCompareA] = useState<string>(sessions[0]?.id || '');
  const [compareB, setCompareB] = useState<string>(sessions[1]?.id || sessions[0]?.id || '');
  const [showComparison, setShowComparison] = useState(false);

  // Replay State
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [replayFilter, setReplayFilter] = useState<'all' | 'tool_call' | 'file_write' | 'file_read'>('all');

  // Filtered replay events
  const filteredReplayEvents = useMemo(() => {
    if (replayFilter === 'all') return replayEvents;
    return replayEvents.filter((e) => e.activityType === replayFilter);
  }, [replayEvents, replayFilter]);

  // Filtered sessions list by search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.workspaceName.toLowerCase().includes(q) ||
        s.recordingStatus.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Replay timer loop
  useEffect(() => {
    if (!isReplaying || filteredReplayEvents.length === 0) return;

    const intervalMs = Math.max(100, Math.floor(1000 / replaySpeed));
    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        const next = prev + 1;
        if (next >= filteredReplayEvents.length) {
          setIsReplaying(false);
          return filteredReplayEvents.length - 1;
        }
        const currentEvt = filteredReplayEvents[next];
        if (currentEvt && onReplayStep) {
          onReplayStep(currentEvt);
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isReplaying, replaySpeed, filteredReplayEvents, onReplayStep]);

  const currentReplayingEvent = filteredReplayEvents[replayIndex] || null;

  const handleStartReplay = () => {
    if (filteredReplayEvents.length === 0) {
      if (selectedSessionId) {
        onSelectSession(selectedSessionId);
      }
    }
    if (replayIndex >= filteredReplayEvents.length - 1) {
      setReplayIndex(0);
    }
    setIsReplaying(true);
  };

  const handlePauseReplay = () => {
    setIsReplaying(false);
  };

  const handleResetReplay = () => {
    setIsReplaying(false);
    setReplayIndex(0);
  };

  const handleScrubberChange = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, filteredReplayEvents.length - 1));
    setReplayIndex(clamped);
    if (filteredReplayEvents[clamped] && onReplayStep) {
      onReplayStep(filteredReplayEvents[clamped]);
    }
  };

  const handleRunComparison = () => {
    if (onCompareSessions && compareA && compareB) {
      onCompareSessions(compareA, compareB);
      setShowComparison(true);
    }
  };

  return (
    <div className="tab-full-view">
      <div className="section-header">Persistent Session History & Replay</div>

      {/* Replay Console */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>Event Replay Console</span>
              <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                [{selectedSessionId || 'No Session Selected'}]
              </span>
            </div>
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
                  color: replaySpeed === speed ? '#000' : 'var(--text-secondary)',
                  fontWeight: replaySpeed === speed ? 700 : 500
                }}
                onClick={() => setReplaySpeed(speed)}
              >
                {speed}x
              </button>
            ))}

            <select
              value={replayFilter}
              onChange={(e) => {
                setReplayFilter(e.target.value as any);
                setReplayIndex(0);
              }}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
            >
              <option value="all">All Events</option>
              <option value="tool_call">Tool Calls Only</option>
              <option value="file_write">Writes Only</option>
              <option value="file_read">Reads Only</option>
            </select>

            {isReplaying ? (
              <button
                className="view-tab-btn"
                style={{ backgroundColor: 'var(--accent-amber)', color: '#000', fontWeight: 600 }}
                onClick={handlePauseReplay}
              >
                Pause
              </button>
            ) : (
              <button
                className="view-tab-btn"
                style={{ backgroundColor: 'var(--accent-green)', color: '#000', fontWeight: 600 }}
                onClick={handleStartReplay}
              >
                Start Replay
              </button>
            )}

            <button
              className="view-tab-btn"
              style={{ backgroundColor: '#1e293b', color: '#fff' }}
              onClick={handleResetReplay}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Scrubber Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filteredReplayEvents.length > 0 ? replayIndex + 1 : 0}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(0, filteredReplayEvents.length - 1)}
            value={replayIndex}
            onChange={(e) => handleScrubberChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
            disabled={filteredReplayEvents.length === 0}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filteredReplayEvents.length}
          </span>
        </div>

        {/* Current Replayed Event Card */}
        {currentReplayingEvent ? (
          <div
            style={{
              backgroundColor: '#0a0f18',
              border: '1px solid #1e293b',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                {currentReplayingEvent.activityType.toUpperCase()}
              </span>
              <span style={{ color: '#fff', marginLeft: 8 }}>
                {currentReplayingEvent.filePath || currentReplayingEvent.toolName || currentReplayingEvent.source}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                [{currentReplayingEvent.provider}]
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date(currentReplayingEvent.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filteredReplayEvents.length === 0
              ? 'Select a session below and click Load to stream events for chronological replay.'
              : 'Ready to replay.'}
          </div>
        )}
      </div>

      {/* Session Comparison Section */}
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
            <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>Compare Sessions</span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Analyze differences in event volume, duration, tool calls, and touched files between two sessions.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.workspaceName} ({s.id.slice(0, 12)}...)
                </option>
              ))}
            </select>

            <span style={{ color: 'var(--text-muted)' }}>vs</span>

            <select
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11
              }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.workspaceName} ({s.id.slice(0, 12)}...)
                </option>
              ))}
            </select>

            <button
              className="view-tab-btn primary"
              style={{ backgroundColor: '#0284c7', color: '#fff', fontWeight: 600 }}
              onClick={handleRunComparison}
            >
              Compare
            </button>
          </div>
        </div>

        {/* Comparison Result Table */}
        {showComparison && comparisonResult && (
          <div style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration Diff</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
                  {(comparisonResult.durationDiffMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Events Diff</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
                  {comparisonResult.eventsDiff}
                </div>
              </div>
              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tool Calls Diff</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                  {comparisonResult.toolCallsDiff}
                </div>
              </div>
              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Common Files</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#a855f7' }}>
                  {comparisonResult.filesTouchedBoth.length}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Files touched ONLY in Session A ({comparisonResult.filesTouchedAOnly.length}):
                </div>
                {comparisonResult.filesTouchedAOnly.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>None</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 16, color: '#94a3b8' }}>
                    {comparisonResult.filesTouchedAOnly.slice(0, 5).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                    {comparisonResult.filesTouchedAOnly.length > 5 && (
                      <li>+{comparisonResult.filesTouchedAOnly.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>

              <div style={{ background: '#0a0f18', padding: 10, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Files touched ONLY in Session B ({comparisonResult.filesTouchedBOnly.length}):
                </div>
                {comparisonResult.filesTouchedBOnly.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>None</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 16, color: '#94a3b8' }}>
                    {comparisonResult.filesTouchedBOnly.slice(0, 5).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                    {comparisonResult.filesTouchedBOnly.length > 5 && (
                      <li>+{comparisonResult.filesTouchedBOnly.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recorded Workspace Sessions Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <div className="card-title">Recorded Workspace Sessions</div>
        <input
          type="text"
          className="search-input"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            padding: '4px 10px',
            borderRadius: 6,
            width: 220
          }}
        />
      </div>

      {/* Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredSessions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching sessions found.
          </div>
        ) : (
          filteredSessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const isLoaded = s.id === selectedSessionId;
            const isExpanded = expandedSessionId === s.id;
            const startTimeStr = new Date(s.startTime).toLocaleString();

            return (
              <div
                key={s.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${isCurrent ? 'var(--accent-cyan)' : isLoaded ? '#0284c7' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      <span>Errors: {s.errorsCount}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="view-tab-btn"
                      style={{
                        backgroundColor: isLoaded ? 'var(--accent-cyan)' : '#1e293b',
                        color: isLoaded ? '#000' : '#fff',
                        fontWeight: 600
                      }}
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        onSelectSession(s.id);
                      }}
                      title="Load this session events into the replay console"
                    >
                      {isLoaded ? 'Loaded' : 'Load & Replay'}
                    </button>
                    <button
                      className="view-tab-btn"
                      style={{ backgroundColor: '#1e293b', color: '#fff' }}
                      onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                    >
                      {isExpanded ? 'Hide Summary' : 'Summary'}
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

                {/* Expanded Session Summary */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid #1e293b',
                      paddingTop: 10,
                      marginTop: 4,
                      fontSize: 11,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Session Details:</div>
                    <div style={{ color: '#cbd5e1' }}>
                      Workspace Root: <code>{s.workspaceId}</code>
                    </div>
                    <div style={{ color: '#cbd5e1' }}>
                      Active Providers: {s.activeProviders?.join(', ') || 'None'}
                    </div>
                    <div style={{ color: '#cbd5e1' }}>
                      End Time: {s.endTime ? new Date(s.endTime).toLocaleString() : 'In Progress / Active'}
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
