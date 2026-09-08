import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ArrowIcon } from '../components/ArrowIcon/ArrowIcon';
import { AvailableSpacesExperience } from '../components/AvailableSpacesExperience/AvailableSpacesExperience';
import { NearbyAmenities } from './NearbyAmenities';
import {
  ASSET_ROOT,
  offices,
  relatedProjects,
} from './project-data';

type ResponsiveImageProps = {
  name: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
};

function ResponsiveImage({
  name,
  alt,
  className,
  eager = false,
  sizes = '100vw',
}: ResponsiveImageProps) {
  return (
    <picture className={className}>
      <source srcSet={`${ASSET_ROOT}/${name}.webp`} type="image/webp" sizes={sizes} />
      <img
        src={`${ASSET_ROOT}/${name}.jpg`}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </picture>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > Math.min(window.innerHeight * 0.7, 560));
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('fortis-menu-locked', menuOpen);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('fortis-menu-locked');
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`fortis-header${scrolled ? ' is-sticky' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
      <div className="fortis-header__row">
        <a className="fortis-logo" href="/" aria-label="Fortis home">
          <img src={`${ASSET_ROOT}/logo.svg`} alt="Fortis" />
        </a>

        <button
          className="fortis-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="fortis-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <nav id="fortis-navigation" className="fortis-navigation" aria-label="Primary navigation">
          <ul>
            <li className="fortis-navigation__projects">
              <a href="https://www.fortis.com.au/projects/">Projects</a>
              <ul className="fortis-navigation__submenu">
                <li><a href="https://www.fortis.com.au/residential/">Residential</a></li>
                <li><a href="https://www.fortis.com.au/commercial/">Commercial</a></li>
              </ul>
            </li>
            <li><a href="https://www.fortis.com.au/for-sale/">For Sale</a></li>
            <li><a href="https://www.fortis.com.au/for-lease/">For Lease</a></li>
            <li><a href="https://www.fortis.com.au/about/">About us</a></li>
            <li><a href="https://www.fortis.com.au/news/">News &amp; views</a></li>
            <li><a href="https://www.fortis.com.au/contact/">Contact</a></li>
          </ul>
        </nav>

        {menuOpen && (
          <nav className="fortis-mobile-navigation" aria-label="Mobile navigation">
            <ul>
              <li>
                <span>Projects</span>
                <a href="https://www.fortis.com.au/residential/" onClick={closeMenu}>Residential</a>
                <a href="https://www.fortis.com.au/commercial/" onClick={closeMenu}>Commercial</a>
              </li>
              <li><a href="https://www.fortis.com.au/for-sale/" onClick={closeMenu}>For Sale</a></li>
              <li><a href="https://www.fortis.com.au/for-lease/" onClick={closeMenu}>For Lease</a></li>
              <li><a href="https://www.fortis.com.au/about/" onClick={closeMenu}>About us</a></li>
              <li><a href="https://www.fortis.com.au/news/" onClick={closeMenu}>News &amp; views</a></li>
              <li><a href="https://www.fortis.com.au/contact/" onClick={closeMenu}>Contact</a></li>
            </ul>
            <p>Relationship built.<br />Detail driven.<br />Community inspired.</p>
          </nav>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="fortis-hero" aria-label="470 Collins Street">
      <ResponsiveImage
        name="hero"
        alt="Street-level architectural rendering of 470 Collins Street, Melbourne"
        className="fortis-hero__image"
        eager
      />
      <a className="fortis-hero__scroll" href="#project-overview" aria-label="View project details">
        <ArrowIcon direction="down" />
      </a>
    </section>
  );
}

function ProjectOverview() {
  return (
    <section className="project-overview section-frame" id="project-overview">
      <div className="project-overview__intro">
        <div className="project-overview__copy">
          <h1>470 Collins St</h1>
          <p className="project-overview__meta">
            470 Collins Street, Melbourne<br />
            In Planning / Commercial
          </p>
          <div className="project-overview__lead">
            <p>
              Located at the heart of Melbourne’s CBD Western Core, 470 Collins Street is undergoing
              a considered transformation into a contemporary workplace destination.
            </p>
            <p>
              Reimagined by architecture and interior design studio, <a href="https://www.fortis.com.au/carr/">Carr</a>,
              to reflect the evolving expectations of modern occupiers. 470 Collins Street will offer
              contemporary office spaces, elevated amenities and an activated ground plane—delivering
              an <a href="#location">enhanced workplace experience</a> and uplift to A Grade Standard within
              one of the city’s most connected and rapidly evolving precincts.
            </p>
          </div>
          <a className="outline-button" href="#enquire">Enquire</a>
        </div>
        <ResponsiveImage
          name="project-portrait"
          alt="Architectural rendering of the renewed 470 Collins Street tower"
          className="project-overview__portrait project-media"
          sizes="(max-width: 596px) 100vw, 42vw"
        />
      </div>

      <div className="project-overview__site">
        <div className="project-overview__site-copy">
          <h2>The site</h2>
          <p>
            470 Collins Street holds a highly connected position on one of Melbourne’s most
            distinguished commercial boulevards. The surrounding precinct brings together major
            financial, legal and corporate businesses, with Southern Cross Station, tram routes,
            laneways, retail and dining all close by.
          </p>
          <p>
            Its central location combines strong transport connections, street-level activity and
            lasting commercial appeal.
          </p>
        </div>
        <ResponsiveImage
          name="site"
          alt="Collins Street streetscape in central Melbourne"
          className="project-overview__site-image project-media"
          sizes="(max-width: 596px) 100vw, 42vw"
        />
      </div>
    </section>
  );
}

function ProjectStats() {
  return (
    <section className="project-stats section-frame" aria-label="Project statistics">
      <div className="section-rule" />
      <dl>
        <div><dt>NLA</dt><dd>11,450m²</dd></div>
        <div><dt>Levels</dt><dd>16</dd></div>
        <div><dt>Completion</dt><dd>Q2 2027</dd></div>
      </dl>
    </section>
  );
}

function InquiryForm() {
  const [submitted, setSubmitted] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    event.currentTarget.reset();
    setSubmitted(true);
  };

  return (
    <section className="project-enquiry section-frame" id="enquire">
      <div className="project-enquiry__content">
        <p className="project-enquiry__intro">
          For commercial leasing enquiries, enter your details below and someone from our team will get in touch.
        </p>
        {submitted ? (
          <div className="form-success" role="status">
            <h2>Thank you.</h2>
            <p>Your enquiry has been prepared. The live submission endpoint can be connected during integration.</p>
            <button className="outline-button" type="button" onClick={() => setSubmitted(false)}>New enquiry</button>
          </div>
        ) : (
          <form className="fortis-form" onSubmit={submit}>
            <div className="fortis-form__row">
              <label><span>First name</span><input name="firstName" placeholder="First Name*" autoComplete="given-name" required /></label>
              <label><span>Last name</span><input name="lastName" placeholder="Last name*" autoComplete="family-name" required /></label>
            </div>
            <label><span>Email</span><input type="email" name="email" placeholder="Email*" autoComplete="email" required /></label>
            <label><span>Telephone</span><input type="tel" name="phone" placeholder="Telephone*" autoComplete="tel" required /></label>
            <label><span>Postal code</span><input name="postalCode" placeholder="Postal code*" autoComplete="postal-code" required /></label>
            <div className="fortis-form__legal">
              <p>
                Fortis is committed to protecting and respecting your privacy. Personal information
                is used to administer enquiries and provide requested products and services.
              </p>
              <label className="fortis-form__consent">
                <input type="checkbox" name="marketingConsent" />
                <span>I agree to receive other communications from Fortis.</span>
              </label>
              <p>
                You may unsubscribe at any time. By submitting this form, you consent to Fortis
                storing and processing the information provided to deliver the requested content.
              </p>
            </div>
            <button className="outline-button" type="submit">Enquire</button>
          </form>
        )}
        <div className="section-rule" />
      </div>
    </section>
  );
}

function RelatedProjects() {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <section className="related-projects section-frame">
      <div className="section-rule" />
      <h2>Similar Projects</h2>
      <div className="related-projects__viewport">
        <div className="related-projects__list" ref={listRef}>
          {relatedProjects.map((project) => (
            <article className="related-card" key={project.name}>
              <a href={project.href}>
                <ResponsiveImage name={project.image} alt={project.name} sizes="(max-width: 596px) 78vw, 30vw" />
                <h3>{project.name}</h3>
                <p>{project.address}</p>
              </a>
            </article>
          ))}
        </div>
        <button
          className="carousel-button related-projects__next"
          type="button"
          aria-label="Show more similar projects"
          onClick={() => listRef.current?.scrollBy({ left: listRef.current.clientWidth * 0.82, behavior: 'smooth' })}
        >
          <ArrowIcon />
        </button>
      </div>
    </section>
  );
}

function Footer() {
  const [subscribed, setSubscribed] = useState(false);
  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    event.currentTarget.reset();
    setSubscribed(true);
  };

  return (
    <footer className="fortis-footer">
      <div className="fortis-footer__main section-frame">
        <div className="fortis-footer__subscribe">
          <p>Subscribe to our newsletter to stay informed on our latest residential, commercial, and retail opportunities.</p>
          {subscribed ? (
            <p className="fortis-footer__thanks" role="status">Thank you for subscribing.</p>
          ) : (
            <form onSubmit={subscribe}>
              <label><span>Email address</span><input type="email" placeholder="Email address*" required /></label>
              <button type="submit" aria-label="Subscribe"><ArrowIcon /></button>
            </form>
          )}
        </div>
        {offices.map((office) => (
          <address key={office.city}>
            <h3>{office.city}</h3>
            {office.lines.map((line) => <span key={line}>{line}</span>)}
          </address>
        ))}
      </div>
      <div className="fortis-footer__bottom section-frame">
        <div>
          <h3>Follow us</h3>
          <nav aria-label="Social media">
            <a href="https://instagram.com/fortisdg">Instagram</a>
            <a href="https://facebook.com/fortisdg">Facebook</a>
            <a href="https://www.linkedin.com/company/fortisdg/">LinkedIn</a>
          </nav>
        </div>
        <nav className="fortis-footer__legal" aria-label="Legal">
          <span>© Fortis 2026</span>
          <a href="https://www.fortis.com.au/privacy-policy/">Privacy policy</a>
          <a href="https://www.fortis.com.au/disclaimer/">Disclaimer</a>
          <a href="https://www.fortis.com.au/cookie-policy/">Cookie policy</a>
          <button type="button" onClick={() => window.dispatchEvent(new Event('fortis:cookie-settings'))}>Cookie settings</button>
        </nav>
      </div>
    </footer>
  );
}

type CookieChoice = 'all' | 'necessary' | 'custom' | null;

function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice>(() => {
    try {
      return localStorage.getItem('fortis-cookie-choice') as CookieChoice;
    } catch {
      return null;
    }
  });
  const [customising, setCustomising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const reopen = () => {
      setChoice(null);
      setCustomising(true);
    };
    window.addEventListener('fortis:cookie-settings', reopen);
    return () => window.removeEventListener('fortis:cookie-settings', reopen);
  }, []);

  const save = (nextChoice: Exclude<CookieChoice, null>) => {
    try {
      localStorage.setItem('fortis-cookie-choice', nextChoice);
    } catch {
      // Consent still works for the current page when storage is unavailable.
    }
    setChoice(nextChoice);
    setCustomising(false);
  };

  if (choice && !customising) return null;

  return (
    <aside className={`cookie-banner${customising ? ' is-customising' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cookie-title">
      <div className="cookie-banner__copy">
        <h2 id="cookie-title">This website uses cookies</h2>
        <p>
          We use cookies to enhance your browsing experience, personalise content and analyse traffic.
          Choose your preferred settings below.
        </p>
        {customising && (
          <div className="cookie-banner__options">
            <label><input type="checkbox" checked disabled /> Necessary cookies</label>
            <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> Analytics cookies</label>
            <label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /> Marketing cookies</label>
          </div>
        )}
      </div>
      <div className="cookie-banner__actions">
        {customising ? (
          <button type="button" className="cookie-primary" onClick={() => save(analytics || marketing ? 'custom' : 'necessary')}>Save preferences</button>
        ) : (
          <button type="button" className="cookie-primary" onClick={() => setCustomising(true)}>Customise</button>
        )}
        <button type="button" onClick={() => save('necessary')}>Necessary cookies only</button>
        <button type="button" onClick={() => save('all')}>Accept all cookies</button>
      </div>
    </aside>
  );
}

export function FortisProjectPage() {
  useEffect(() => {
    document.documentElement.classList.add('fortis-project-document');
    return () => document.documentElement.classList.remove('fortis-project-document');
  }, []);

  return (
    <div className="fortis-project-page">
      <Header />
      <main>
        <Hero />
        <ProjectOverview />
        <ProjectStats />
        <section className="project-selector section-frame" id="available-spaces">
          <AvailableSpacesExperience embedded />
        </section>
        <NearbyAmenities />
        <InquiryForm />
        <RelatedProjects />
      </main>
      <Footer />
      <CookieConsent />
    </div>
  );
}
