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
        <svg
          width="20"
          height="20"
          viewBox="0 0 512 512"
          style={{ borderRadius: 4, flexShrink: 0 }}
        >
          <defs>
            <linearGradient id="hdr-a" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#74f7e8" />
              <stop offset=".52" stopColor="#50bdf6" />
              <stop offset="1" stopColor="#a78bfa" />
            </linearGradient>
            <radialGradient id="hdr-c" cx=".3" cy=".2" r=".8">
              <stop stopColor="#f4ffff" />
              <stop offset=".25" stopColor="#74f7e8" />
              <stop offset=".7" stopColor="#50bdf6" />
              <stop offset="1" stopColor="#8069e9" />
            </radialGradient>
            <filter id="hdr-g" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="512" height="512" rx="112" fill="#0b1020" />
          <g transform="translate(256 256)" fill="none" stroke="url(#hdr-a)" strokeLinecap="round">
            <circle r="154" strokeWidth="3" opacity=".26" />
            <ellipse rx="164" ry="75" transform="rotate(-38)" strokeWidth="4" />
            <ellipse rx="164" ry="75" transform="rotate(48)" strokeWidth="3" opacity=".72" />
            <path
              d="M-134 72 L-51 7 L-6 -64 L59 -43 L117 -116 M-109 -88 L-51 7 L27 78 L103 60 L143 3 M-51 7 L59 -43 L103 60 M27 78 L59 -43"
              strokeWidth="2.5"
              opacity=".72"
            />
            <path d="M0 -185 V-145 M-185 0 H-145 M145 0 H185 M0 145 V185" strokeWidth="2" opacity=".4" />
          </g>
          <g filter="url(#hdr-g)">
            <circle cx="122" cy="176" r="9" fill="#7df7e8" />
            <circle cx="205" cy="264" r="8" fill="#65e4ed" />
            <circle cx="315" cy="217" r="9" fill="#80ddff" />
            <circle cx="355" cy="319" r="7" fill="#a78bfa" />
            <circle cx="202" cy="342" r="6" fill="#6ad9f5" />
            <circle cx="319" cy="378" r="7" fill="#8c8bff" />
            <circle cx="373" cy="165" r="6" fill="#7df7e8" />
          </g>
          <path d="M256 199 L301 225 L301 277 L256 303 L211 277 L211 225 Z" fill="#182f4b" stroke="url(#hdr-a)" strokeWidth="4" />
          <path d="M256 215 L286 232 L286 270 L256 287 L226 270 L226 232 Z" fill="url(#hdr-c)" filter="url(#hdr-g)" />
          <path d="M241 239 L256 230 L271 239 L271 257 L256 266 L241 257 Z" fill="#efffff" />
        </svg>
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
        <span style={{ fontWeight: 700, letterSpacing: '0.3px' }}>Aetheris</span>
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
