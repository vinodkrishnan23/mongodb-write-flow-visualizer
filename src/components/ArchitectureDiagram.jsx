import React from 'react';

const NodeLayers = ({ title }) => (
  <div className="node-box">
    <h4>{title}</h4>
    <div className="node-layer ram">Block Cache (RAM 🔵)</div>
    <div className="node-layer ram">WT Log Buffer (RAM 🔵)</div>
    <div className="node-layer disk">Journal File (Disk 🟠)</div>
    <div className="node-layer disk">.wt Data Files (Disk 🟠)</div>
  </div>
);

export default function ArchitectureDiagram() {
  return (
    <section className="architecture-section">
      <h2>Replication Architecture</h2>
      <div className="architecture-grid">
        <div className="application-box">APPLICATION</div>
        <NodeLayers title="PRIMARY NODE" />
        <div className="secondary-stack">
          <NodeLayers title="SECONDARY A" />
          <NodeLayers title="SECONDARY B" />
        </div>
      </div>
      <div className="architecture-arrows">
        <span>App → Primary: OP_MSG write command</span>
        <span>Primary → Secondaries: Oplog stream over network</span>
        <span>Secondaries → Primary: replSetUpdatePosition ACK</span>
      </div>
      <p className="architecture-note">Secondary reads from Primary&apos;s Block Cache (RAM), NOT disk.</p>
    </section>
  );
}
