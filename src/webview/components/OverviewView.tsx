import React from 'react';
import { ActivityEvent, AdapterHealth, SessionRecord, WorkspaceStats } from '../../types/events';

interface OverviewViewProps {
  session: SessionRecord | null;
  stats: WorkspaceStats;
  adapters: AdapterHealth[];
  events: ActivityEvent[];
  onOpenFile: (path: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  session,
  stats,
  adapters,
  events,
  onOpenFile
}) => {
  // Aggregate stats from events
  const providerCounts = events.reduce((acc, e) => {
    acc[e.provider] = (acc[e.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activityTypeCounts = events.reduce((acc, e) => {
    acc[e.activityType] = (acc[e.activityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="tab-full-view">
      <div className="section-header">Live Activity Overview</div>

      {/* Top 4 Stat Boxes */}
      <div className="stats-grid">
        <div className="stat-box">
          <span className="card-title">Total Ingested Events</span>
          <span className="stat-box-num">{events.length}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Session: {session?.id || 'Active'}
          </span>
        </div>
        <div className="stat-box">
          <span className="card-title">Files Touched</span>
          <span className="stat-box-num" style={{ color: 'var(--accent-amber)' }}>
            {stats.touchedCount}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Out of {stats.totalFiles} workspace files
          </span>
        </div>
        <div className="stat-box">
          <span className="card-title">Agent Tool Calls</span>
          <span className="stat-box-num" style={{ color: 'var(--accent-green)' }}>
            {events.filter((e) => e.activityType === 'tool_call').length}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Explicitly reported</span>
        </div>
        <div className="stat-box">
          <span className="card-title">Observed FS Edits</span>
          <span className="stat-box-num" style={{ color: 'var(--accent-orange)' }}>
            {events.filter((e) => e.activityType === 'file_write').length}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>VS Code editor & fs</span>
        </div>
      </div>

      {/* Adapters Health Status */}
      <div style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>Configured Agent Integrations</div>
        <div className="adapters-list">
          {adapters.map((a) => (
            <div key={a.provider} className="adapter-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#fff' }}>{a.name}</span>
                <span className={`adapter-status-pill ${a.status}`}>{a.status}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {a.diagnostic || 'No diagnostic message'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Events captured: {a.eventsCaptured}
                {a.lastEventTime ? ` • Last active: ${new Date(a.lastEventTime).toLocaleTimeString()}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="stat-box">
          <div className="card-title">Events By Provider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {Object.entries(providerCounts).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No events recorded yet.</div>
            ) : (
              Object.entries(providerCounts).map(([prov, cnt]) => (
                <div key={prov} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ textTransform: 'capitalize' }}>{prov}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cnt}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stat-box">
          <div className="card-title">Events By Activity Type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {Object.entries(activityTypeCounts).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No events recorded yet.</div>
            ) : (
              Object.entries(activityTypeCounts).map(([type, cnt]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cnt}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
