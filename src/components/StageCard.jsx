import React from 'react';

const categoryColors = {
  ram: '#3b82f6',
  disk: '#f97316',
  network: '#a855f7',
  logic: '#6b7280'
};

export default function StageCard({ stage, status, onClick, showAck }) {
  const glowColor = categoryColors[stage.category] || '#6b7280';

  return (
    <button
      type="button"
      className={`stage-card ${status}`}
      style={{ borderLeftColor: glowColor, '--glow-color': glowColor }}
      onClick={onClick}
    >
      <div className="stage-card-header">
        <span className="stage-icon" aria-hidden="true">
          {stage.icon}
        </span>
        <div>
          <h3>{stage.title}</h3>
          <p>{stage.subtitle}</p>
        </div>
      </div>
      {showAck ? <span className="ack-badge">ACK</span> : null}
      {status === 'completed' ? <span className="completed-check">✓</span> : null}
    </button>
  );
}
