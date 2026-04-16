import React, { useEffect, useRef } from 'react';
import StageCard from './StageCard';

export default function PipelineView({ stages, currentStageIndex, selectedWC, onSelectStage }) {
  const cardRefs = useRef({});

  useEffect(() => {
    if (currentStageIndex < 0) return;
    const active = stages[currentStageIndex];
    const activeNode = active ? cardRefs.current[active.id] : null;
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentStageIndex, stages]);

  return (
    <section>
      <h2>Write Pipeline</h2>
      <div className="pipeline-container">
        {stages.map((stage, index) => {
          let status = 'pending';
          if (index < currentStageIndex) status = 'completed';
          if (index === currentStageIndex) status = 'active';

          return (
            <div key={stage.id} ref={(node) => (cardRefs.current[stage.id] = node)}>
              <StageCard
                stage={stage}
                status={status}
                showAck={Boolean(stage.isAckPoint?.[selectedWC])}
                onClick={() => onSelectStage(index)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
