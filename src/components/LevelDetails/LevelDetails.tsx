import type { Space } from '../../data/spaces';

type Props = {
  space: Space | null;
  hasPlan: boolean;
  onViewPlan: () => void;
  onEnquire: () => void;
  onClear: () => void;
};

export function LevelDetails({ space, hasPlan, onViewPlan, onEnquire, onClear }: Props) {
  if (!space) {
    return (
      <section className="level-details is-empty" aria-live="polite">
        <span className="details-kicker">Selected space</span>
        <p>Select a level on the façade or from the availability index to see more information.</p>
      </section>
    );
  }

  return (
    <section className="level-details" aria-live="polite">
      <div className="details-heading">
        <div>
          <span className="details-kicker">Selected space</span>
          <h2>Level {space.displayLevel}</h2>
        </div>
        <button className="text-button" type="button" onClick={onClear}>Clear</button>
      </div>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{space.availabilityLabel}</dd>
        </div>
        {space.area && <div><dt>Area</dt><dd>{space.area}</dd></div>}
      </dl>
      {space.suites && (
        <div className="suite-list">
          <h3>Suites</h3>
          {space.suites.map((suite) => (
            <div key={suite.id} className={`suite-row status-${suite.status}`}>
              <span>{suite.name}</span>
              <span>{suite.area ?? (suite.status === 'leased' ? 'Leased' : 'Available')}</span>
            </div>
          ))}
        </div>
      )}
      <div className="detail-actions">
        {hasPlan && <button className="button secondary" type="button" onClick={onViewPlan}>View floor plan</button>}
        {space.status !== 'leased' && space.status !== 'unavailable' && <button className="button primary" type="button" onClick={onEnquire}>Enquire</button>}
      </div>
      {space.status === 'leased' && <p className="leased-note">This level is currently leased and is not open for enquiries.</p>}
      {space.status === 'unavailable' && <p className="leased-note">This level is not currently offered for lease.</p>}
    </section>
  );
}
