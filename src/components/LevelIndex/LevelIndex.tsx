import { useEffect, useId, useState } from 'react';
import type { Space } from '../../data/spaces';

type Props = {
  spaces: Space[];
  selectedLevel: number | null;
  hoveredLevel: number | null;
  onSelect: (level: number) => void;
  onHover: (level: number | null) => void;
};

function hasCompactIndex() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 760px)').matches;
}

export function LevelIndex({ spaces, selectedLevel, hoveredLevel, onSelect, onHover }: Props) {
  const listId = useId();
  const [isCompact, setIsCompact] = useState(hasCompactIndex);
  const [mobileOpen, setMobileOpen] = useState(false);
  const expanded = !isCompact || mobileOpen;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setIsCompact(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const selectLevel = (level: number) => {
    onSelect(level);
    if (isCompact) setMobileOpen(false);
  };

  return (
    <section className="level-index" aria-labelledby="availability-heading">
      <button
        className="section-rule-heading level-index-toggle"
        type="button"
        aria-controls={listId}
        aria-expanded={expanded}
        disabled={!isCompact}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span id="availability-heading" className="level-index-title">Availability</span>
        <span className="level-index-count">{String(spaces.length).padStart(2, '0')} levels</span>
        <i className="level-index-chevron" aria-hidden="true" />
      </button>
      <div className="level-list" id={listId} hidden={!expanded}>
        {spaces.map((space) => (
          <button
            type="button"
            key={space.level}
            className={`level-row${selectedLevel === space.level ? ' is-selected' : ''}${hoveredLevel === space.level ? ' is-hovered' : ''}`}
            aria-label={`Select Level ${space.displayLevel}`}
            aria-pressed={selectedLevel === space.level}
            onClick={() => selectLevel(space.level)}
            onMouseEnter={() => onHover(space.level)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(space.level)}
            onBlur={() => onHover(null)}
          >
            <span className="level-number">{space.displayLevel}</span>
            <span className="level-name">Level</span>
            <span className="row-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}
