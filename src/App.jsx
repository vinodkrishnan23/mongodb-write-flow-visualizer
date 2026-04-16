import React, { useEffect, useMemo, useState } from 'react';
import stages from './stageData';
import WriteConcernSelector from './components/WriteConcernSelector';
import PipelineView from './components/PipelineView';
import StageDetailPanel from './components/StageDetailPanel';
import ArchitectureDiagram from './components/ArchitectureDiagram';
import ComparisonTable from './components/ComparisonTable';
import OplogVisibilityExplainer from './components/OplogVisibilityExplainer';

export default function App() {
  const [selectedWC, setSelectedWC] = useState('wmajority');
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1500);

  const filteredStages = useMemo(
    () => stages.filter((stage) => stage.applicableTo.includes(selectedWC)),
    [selectedWC]
  );

  useEffect(() => {
    if (!isPlaying) return;
    if (currentStageIndex >= filteredStages.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCurrentStageIndex((i) => i + 1), speed);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStageIndex, speed, filteredStages.length]);

  const handlePlay = () => {
    if (currentStageIndex >= filteredStages.length - 1) setCurrentStageIndex(-1);
    setIsPlaying(true);
  };

  const handleStep = () => {
    if (currentStageIndex < filteredStages.length - 1) setCurrentStageIndex((i) => i + 1);
  };

  const handleReset = () => {
    setCurrentStageIndex(-1);
    setIsPlaying(false);
  };

  const handleWCChange = (wc) => {
    setSelectedWC(wc);
    handleReset();
  };

  const activeStage = currentStageIndex >= 0 ? filteredStages[currentStageIndex] : null;

  return (
    <main className="app-shell">
      <header>
        <h1>MongoDB Write Flow Visualizer</h1>
      </header>

      <WriteConcernSelector selected={selectedWC} onChange={handleWCChange} />

      <section className="controls">
        <button type="button" onClick={isPlaying ? () => setIsPlaying(false) : handlePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={handleStep}>
          Step Forward
        </button>
        <button type="button" onClick={handleReset}>
          Reset
        </button>
        <label htmlFor="speed-slider">
          Speed: {speed}ms
          <input
            id="speed-slider"
            type="range"
            min="500"
            max="3000"
            step="100"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      </section>

      <PipelineView
        stages={filteredStages}
        currentStageIndex={currentStageIndex}
        selectedWC={selectedWC}
        onSelectStage={(index) => {
          setCurrentStageIndex(index);
          setIsPlaying(false);
        }}
      />

      <StageDetailPanel stage={activeStage} />
      <ArchitectureDiagram />
      <ComparisonTable />
      <OplogVisibilityExplainer />
    </main>
  );
}
