import { useCallback, useEffect, useMemo, useState } from 'react';
import { interactiveSpaces, spaceByLevel } from '../../data/spaces';
import { closestFrameForAngle, sequenceManifest } from '../../lib/assetManifest';
import { EnquiryPanel } from '../EnquiryPanel/EnquiryPanel';
import { LevelDetails } from '../LevelDetails/LevelDetails';
import { LevelIndex } from '../LevelIndex/LevelIndex';
import { SequenceViewer } from '../SequenceViewer/SequenceViewer';
import { UnitPlanViewer } from '../UnitPlanViewer/UnitPlanViewer';

type Props = { embedded?: boolean };

function readInitialState() {
  const params = new URLSearchParams(window.location.search);
  const fallback = params.get('fallback') === '1';
  const requestedLevel = Number(params.get('level'));
  const selectedLevel = spaceByLevel.has(requestedLevel) ? requestedLevel : null;
  const requestedAngle = Number(params.get('angle'));
  const currentFrame = fallback
    ? sequenceManifest.frontFrame
    : Number.isFinite(requestedAngle) && params.has('angle')
      ? closestFrameForAngle(requestedAngle).id
      : sequenceManifest.frontFrame;
  return { fallback, selectedLevel, currentFrame };
}

export function AvailableSpacesExperience({ embedded = false }: Props) {
  const initial = useMemo(readInitialState, []);
  const [currentFrame, setCurrentFrame] = useState(initial.currentFrame);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(initial.selectedLevel);
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const selectedSpace = selectedLevel === null ? null : spaceByLevel.get(selectedLevel) ?? null;
  const selectableUnits = selectedSpace?.suites?.filter(
    (unit) => unit.status === 'available' || unit.status === 'under-offer',
  ) ?? [];
  const selectedUnit = selectableUnits.find((unit) => unit.id === selectedUnitId) ?? null;

  useEffect(() => {
    if (import.meta.env.DEV) {
      for (const warning of sequenceManifest.warnings) console.warn(`[asset manifest] ${warning}`);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedLevel === null) params.delete('level');
    else params.set('level', String(selectedLevel));
    if (initial.fallback) params.set('fallback', '1');
    else params.set('angle', String(sequenceManifest.frames[currentFrame].angle));
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [currentFrame, initial.fallback, selectedLevel]);

  const clearSelection = useCallback(() => {
    setSelectedLevel(null);
    setHoveredLevel(null);
    setSelectedUnitId(null);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || enquiryOpen) return;
      if (selectedUnitId) setSelectedUnitId(null);
      else clearSelection();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearSelection, enquiryOpen, selectedUnitId]);

  const selectLevel = (level: number | null) => {
    setSelectedLevel(level);
    setSelectedUnitId(null);
  };

  return (
    <div className={`available-spaces-experience${embedded ? ' is-embedded' : ''}`}>
      <div className="experience-grid">
        <section className="viewer-column" aria-label="Building selector">
          {selectedUnit && selectedSpace ? (
            <UnitPlanViewer
              space={selectedSpace}
              unit={selectedUnit}
              onBack={() => setSelectedUnitId(null)}
              onInquire={() => setEnquiryOpen(true)}
            />
          ) : (
            <SequenceViewer
              currentFrame={currentFrame}
              selectedLevel={selectedLevel}
              hoveredLevel={hoveredLevel}
              units={selectableUnits}
              fallback={initial.fallback}
              onFrameChange={setCurrentFrame}
              onSelectLevel={selectLevel}
              onHoverLevel={setHoveredLevel}
              onSelectUnit={setSelectedUnitId}
            />
          )}
        </section>

        <aside className="details-column">
          <LevelDetails
            space={selectedSpace}
            hasPlan={selectableUnits.length > 0}
            onViewPlan={() => setSelectedUnitId(selectableUnits[0]?.id ?? null)}
            onEnquire={() => setEnquiryOpen(true)}
            onClear={clearSelection}
          />
        </aside>

        <aside className="index-column">
          <LevelIndex
            spaces={interactiveSpaces}
            selectedLevel={selectedLevel}
            hoveredLevel={hoveredLevel}
            onSelect={selectLevel}
            onHover={setHoveredLevel}
          />
          
        </aside>
      </div>

      {enquiryOpen && selectedSpace && (
        <EnquiryPanel
          space={selectedSpace}
          suite={selectedUnit ?? undefined}
          onClose={() => setEnquiryOpen(false)}
        />
      )}
      {import.meta.env.DEV && sequenceManifest.warnings.length > 0 && (
        <span className="sr-only" data-asset-warnings={sequenceManifest.warnings.join(' | ')} />
      )}
    </div>
  );
}
