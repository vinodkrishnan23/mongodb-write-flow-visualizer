import React from 'react';

const rows = [
  { event: 'WT transaction commits in memory', w0: true, w1: true, wmajority: true },
  { event: 'Primary journal flushed to disk', w0: false, w1: true, wmajority: true },
  { event: 'oplogReadTimestamp advances (RAM)', w0: false, w1: false, wmajority: true },
  { event: 'Secondary received entry (from Primary RAM)', w0: false, w1: false, wmajority: true },
  { event: 'Secondary journaled entry to disk', w0: false, w1: false, wmajority: true },
  { event: 'Majority commit point advanced', w0: false, w1: false, wmajority: true },
  { event: 'Client receives ACK', w0: 'star', w1: true, wmajority: true },
  { event: 'Survives Primary crash', w0: false, w1: true, wmajority: true },
  { event: 'Survives majority node crash', w0: false, w1: false, wmajority: true }
];

const renderCell = (value) => {
  if (value === 'star') {
    return <span className="cell-yes">✓*</span>;
  }
  return <span className={value ? 'cell-yes' : 'cell-no'}>{value ? '✓' : '✗'}</span>;
};

export default function ComparisonTable() {
  return (
    <section>
      <h2>Write Concern Comparison</h2>
      <div className="table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>w:0</th>
              <th>w:1</th>
              <th>w:majority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.event}>
                <td>{row.event}</td>
                <td>{renderCell(row.w0)}</td>
                <td>{renderCell(row.w1)}</td>
                <td>{renderCell(row.wmajority)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="comparison-note">* w:0 ACK is returned before the write executes on the server.</p>
    </section>
  );
}
