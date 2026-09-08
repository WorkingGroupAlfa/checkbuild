import type { Space, Suite } from '../../data/spaces';

type Props = {
  space: Space;
  unit: Suite;
  onBack: () => void;
  onInquire: () => void;
};

export function UnitPlanViewer({ space, unit, onBack, onInquire }: Props) {
  return (
    <div className="sequence-viewer unit-plan-viewer" role="region" aria-labelledby="unit-plan-title">
      <header className="unit-plan-toolbar">
        <button className="viewer-back unit-plan-back" type="button" autoFocus onClick={onBack}>
          <span aria-hidden="true">←</span>
          Back to Level {space.displayLevel}
        </button>
        <span>Indicative plan</span>
      </header>

      <div className="unit-plan-artwork">
        <svg viewBox="0 0 760 430" role="img" aria-labelledby="placeholder-plan-title placeholder-plan-description">
          <title id="placeholder-plan-title">Placeholder plan for {unit.name}</title>
          <desc id="placeholder-plan-description">Indicative office floor plan with open workspace, meeting rooms and a central core.</desc>
          <path className="plan-outline" d="M38 52H722V366H565L536 392H38Z" />
          <path className="plan-window-line" d="M58 73H701M58 344H546" />
          <path className="plan-wall" d="M235 53V155H38M235 155V366M510 53V155H722M510 155V366M235 258H510" />
          <rect className="plan-core" x="308" y="151" width="135" height="112" />
          <path className="plan-core-line" d="M352 151V263M397 151V263M308 207H443" />
          <path className="plan-desk" d="M82 205h102m-102 24h102m-102 24h102m374-48h104m-104 24h104m-104 24h104" />
          <circle className="plan-table" cx="129" cy="108" r="25" />
          <circle className="plan-table" cx="630" cy="108" r="25" />
          <text x="75" y="315">OPEN WORKSPACE</text>
          <text x="548" y="315">OPEN WORKSPACE</text>
          <text x="344" y="212">CORE</text>
          <text x="92" y="113">MEET</text>
          <text x="593" y="113">MEET</text>
        </svg>
        <span className="plan-placeholder-note">Concept placeholder — replace with final tenancy plan</span>
      </div>

      <div className="unit-plan-information">
        <div className="unit-plan-heading">
          <div>
            <span className="details-kicker">Level {space.displayLevel}</span>
            <h2 id="unit-plan-title">{unit.name}</h2>
          </div>
          <strong>{unit.area}</strong>
        </div>
        <dl className="unit-plan-facts">
          <div><dt>Configuration</dt><dd>{unit.layoutType ?? 'Flexible office'}</dd></div>
          <div><dt>Availability</dt><dd>{unit.availability ?? space.availabilityLabel}</dd></div>
        </dl>
        {unit.description && <p className="unit-plan-description">{unit.description}</p>}
        {unit.features && (
          <ul className="unit-plan-features" aria-label="Highlights">
            {unit.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        )}
        <button className="button primary unit-plan-enquire" type="button" onClick={onInquire}>Inquire selected</button>
      </div>
    </div>
  );
}
