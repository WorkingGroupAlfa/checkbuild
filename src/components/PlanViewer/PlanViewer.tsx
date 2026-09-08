type Props = {
  level: string;
  source: string;
  onBack: () => void;
};

export function PlanViewer({ level, source, onBack }: Props) {
  return (
    <section className="plan-view" aria-labelledby="plan-title">
      <div className="plan-toolbar">
        <button className="back-button" type="button" onClick={onBack}>← Back to building</button>
        <div>
          <span>Floor plan</span>
          <h2 id="plan-title">Level {level}</h2>
        </div>
      </div>
      <img src={source} alt={`Floor plan for Level ${level}`} />
    </section>
  );
}
