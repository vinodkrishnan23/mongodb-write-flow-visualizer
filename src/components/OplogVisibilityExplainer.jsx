import React, { useEffect, useState } from 'react';

const resetState = {
  committed: { 100: false, 101: false, 102: false },
  visibility: 99,
  phase: 'waiting'
};

export default function OplogVisibilityExplainer() {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState(resetState);

  useEffect(() => {
    if (!open) {
      setTimeline(resetState);
      return;
    }

    const t1 = setTimeout(() => {
      setTimeline((prev) => ({
        ...prev,
        committed: { ...prev.committed, 102: true },
        phase: 'T=102 committed (fast)'
      }));
    }, 700);

    const t2 = setTimeout(() => {
      setTimeline((prev) => ({
        ...prev,
        committed: { ...prev.committed, 101: true },
        phase: 'T=101 committed (medium)'
      }));
    }, 1400);

    const t3 = setTimeout(() => {
      setTimeline((prev) => ({
        ...prev,
        committed: { ...prev.committed, 100: true },
        visibility: 102,
        phase: 'T=100 committed (slow) → visibility jumps to T=102'
      }));
    }, 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [open]);

  return (
    <section className="oplog-explainer">
      <h2>Oplog Visibility & all_durable</h2>
      <button type="button" className="collapse-btn" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide explainer' : 'Show explainer'}
      </button>

      {open ? (
        <div className="oplog-content">
          <p>
            Oplog holes happen when newer timestamps commit before older ones. MongoDB does not expose entries to
            secondaries past a hole, preventing out-of-order visibility.
          </p>

          <div className="timeline">
            {[100, 101, 102].map((ts) => (
              <div key={ts} className={`timeline-item ${timeline.committed[ts] ? 'committed' : ''}`}>
                T={ts} {timeline.committed[ts] ? 'committed' : 'pending'}
              </div>
            ))}
            <div className="visibility-line">visibility line: T={timeline.visibility}</div>
            <div className="timeline-phase">{timeline.phase}</div>
          </div>

          <blockquote>
            “all_durable is the timestamp that has no holes in-memory, which may NOT be the case on disk, despite
            &apos;durable&apos; in the name.”
          </blockquote>

          <p className="key-point">
            Key point: secondaries read from Primary&apos;s BLOCK CACHE (RAM), not from Primary&apos;s disk.
          </p>
        </div>
      ) : null}
    </section>
  );
}
