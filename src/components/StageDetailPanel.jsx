import React from 'react';

export default function StageDetailPanel({ stage }) {
  if (!stage) {
    return (
      <section className="detail-panel">
        <h2>Stage Details</h2>
        <p>Select Play or Step Forward to inspect each stage in detail.</p>
      </section>
    );
  }

  return (
    <section className="detail-panel">
      <h2>Stage Details</h2>
      <div className="detail-title">
        <span className="detail-icon" aria-hidden="true">
          {stage.icon}
        </span>
        <div>
          <h3>{stage.title}</h3>
          <p>{stage.subtitle}</p>
        </div>
      </div>
      <p className="detail-description">{stage.description}</p>
      <pre>
        <code>{stage.codeSnippet}</code>
      </pre>
      <ul>
        {stage.keyFacts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </section>
  );
}
