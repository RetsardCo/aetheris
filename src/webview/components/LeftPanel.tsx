import React from 'react';
import { WorkspaceStats } from '../../types/events';

interface LeftPanelProps {
  stats: WorkspaceStats;
  selectedFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
  showAllLabels: boolean;
  onToggleShowAllLabels: (val: boolean) => void;
  attentionOnly: boolean;
  onToggleAttentionOnly: (val: boolean) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  stats,
  selectedFolder,
  onSelectFolder,
  showAllLabels,
  onToggleShowAllLabels,
  attentionOnly,
  onToggleAttentionOnly
}) => {
  return (
    <aside className="left-panel">
      {/* Subtitle / Category */}
      <div className="panel-tagline">
        <span className="folder-dot" style={{ backgroundColor: 'var(--accent-cyan)' }}></span>
        AI WORKSPACE · LIVE MAP
      </div>

      {/* Hero Headline */}
      <div className="hero-heading">
        Your repo,<br />
        thinking out loud.
      </div>

      {/* Subheading */}
      <div className="hero-subheading">
        GitHub Copilot, Google Antigravity & VS Code, traced live as they read, search and edit.
      </div>

      {/* Metrics Row */}
      <div className="metrics-strip">
        <div className="metric-item">
          <span className="metric-val">{stats.totalFiles}</span>
          <span className="metric-lbl">Files</span>
        </div>
        <div className="metric-item">
          <span className="metric-val">{stats.totalFolders}</span>
          <span className="metric-lbl">Folders</span>
        </div>
        <div className="metric-item">
          <span className="metric-val">{stats.totalConnections}</span>
          <span className="metric-lbl">Connections</span>
        </div>
        <div className="metric-item">
          <span className="metric-val" style={{ color: stats.touchedCount > 0 ? 'var(--accent-amber)' : '#ffffff' }}>
            {stats.touchedCount}
          </span>
          <span className="metric-lbl">Touched</span>
        </div>
      </div>

      {/* Top Folders Card */}
      <div className="top-folders-card">
        <div className="card-title">Top Folders</div>
        <div className="folder-list">
          {stats.topFolders.slice(0, 9).map((f) => {
            const isSelected = selectedFolder === f.path;
            return (
              <div
                key={f.path}
                className="folder-item"
                style={{
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.1)' : undefined
                }}
                onClick={() => onSelectFolder(isSelected ? null : f.path)}
                title={`Filter by folder: ${f.path}`}
              >
                <div className="folder-name-wrap">
                  <span className="folder-dot" style={{ backgroundColor: f.color }}></span>
                  <span>{f.path}</span>
                </div>
                <span className="folder-count">{f.count}</span>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="filter-checkboxes">
          <label className="filter-lbl">
            <input
              type="checkbox"
              checked={showAllLabels}
              onChange={(e) => onToggleShowAllLabels(e.target.checked)}
            />
            Show all labels
          </label>
          <label className="filter-lbl">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => onToggleAttentionOnly(e.target.checked)}
            />
            Only what needs attention
          </label>
        </div>
      </div>
    </aside>
  );
};
