import React from 'react';
import { SessionRecord } from '../../types/events';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  seenCount: number;
  totalFiles: number;
  recordingStatus: 'active' | 'paused' | 'stopped';
  activeView: 'graph' | 'overview' | 'timeline' | 'sessions';
  onSelectView: (view: 'graph' | 'overview' | 'timeline' | 'sessions') => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  seenCount,
  totalFiles,
  recordingStatus,
  activeView,
  onSelectView
}) => {
  return (
    <header className="top-header">
      {/* Brand */}
      <div className="brand-section">
        <span
          className="pulse-dot"
          style={{
            backgroundColor:
              recordingStatus === 'active'
                ? 'var(--accent-green)'
                : recordingStatus === 'paused'
                ? 'var(--accent-amber)'
                : 'var(--text-muted)'
          }}
        ></span>
        <span>Agent Brain</span>
      </div>

      {/* Center Search Input */}
      <div className="search-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Right Stats & Navigation */}
      <div className="header-right">
        <div className="seen-counter">
          {seenCount} / {totalFiles} seen
        </div>

        <div className="mode-badge">
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: recordingStatus === 'active' ? 'var(--accent-cyan)' : 'var(--accent-amber)'
            }}
          ></span>
          {recordingStatus === 'active' ? 'live recording' : recordingStatus}
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>1x</span>
        </div>

        {/* View Switcher Tabs */}
        <div className="view-tabs">
          <button
            className={`view-tab-btn ${activeView === 'graph' ? 'active' : ''}`}
            onClick={() => onSelectView('graph')}
          >
            Graph
          </button>
          <button
            className={`view-tab-btn ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => onSelectView('overview')}
          >
            Overview
          </button>
          <button
            className={`view-tab-btn ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => onSelectView('timeline')}
          >
            Timeline
          </button>
          <button
            className={`view-tab-btn ${activeView === 'sessions' ? 'active' : ''}`}
            onClick={() => onSelectView('sessions')}
          >
            Sessions
          </button>
        </div>
      </div>
    </header>
  );
};
