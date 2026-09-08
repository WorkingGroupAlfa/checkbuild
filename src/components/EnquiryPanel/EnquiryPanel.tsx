import { useEffect, useRef, useState } from 'react';
import type { Space, Suite } from '../../data/spaces';
import { submitEnquiry } from '../../services/enquiry';

type Props = { space: Space; suite?: Suite; onClose: () => void };

export function EnquiryPanel({ space, suite, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('modal-open');
      previous?.focus();
    };
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    await submitEnquiry({
      building: '470 Collins Street',
      level: space.displayLevel,
      suite: suite?.name,
      name: String(form.get('name') ?? ''),
      company: String(form.get('company') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      message: String(form.get('message') ?? ''),
    });
    setSubmitting(false);
    setComplete(true);
  };

  return (
    <div className="enquiry-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="enquiry-panel" role="dialog" aria-modal="true" aria-labelledby="enquiry-title">
        <button className="drawer-close" type="button" aria-label="Close enquiry" onClick={onClose}>×</button>
        <span className="details-kicker">Leasing enquiry</span>
        <h2 id="enquiry-title">Let’s talk about<br />{suite?.name ?? `Level ${space.displayLevel}`}.</h2>
        {complete ? (
          <div className="enquiry-complete" role="status">
            <p>Your details are ready.</p>
            <p>This demonstration does not transmit personal information. Connect <code>src/services/enquiry.ts</code> to an approved endpoint to enable submissions.</p>
            <button className="button primary" type="button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="enquiry-context">
              <span>Building <b>470 Collins Street</b></span>
              <span>Level <b>{space.displayLevel}</b></span>
              {suite && <span>Unit <b>{suite.name}</b></span>}
            </div>
            <label>Name<input name="name" autoComplete="name" required /></label>
            <label>Company<input name="company" autoComplete="organization" /></label>
            <div className="field-pair">
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>Phone<input name="phone" type="tel" autoComplete="tel" /></label>
            </div>
            <label>Message<textarea name="message" rows={3} defaultValue={`I’m interested in ${suite ? `${suite.name} on ` : ''}Level ${space.displayLevel} at 470 Collins Street.`} /></label>
            <button className="button primary submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Preparing…' : 'Prepare enquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
