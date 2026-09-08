import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { amenityGroups, type AmenityGroup, type AmenityPlace } from './project-data';

const BUILDING_POSITION: [number, number] = [470, 370];

const HORIZONTAL_STREETS = [
  { name: 'Little Lonsdale Street', y: 34, kind: 'lane', label: false },
  { name: 'Lonsdale Street', y: 92, kind: 'road', label: false },
  { name: 'Little Bourke Street', y: 158, kind: 'lane', label: false },
  { name: 'Bourke Street', y: 224, kind: 'road', label: true },
  { name: 'Little Collins Street', y: 300, kind: 'lane', label: false },
  { name: 'Collins Street', y: 370, kind: 'road', label: true },
  { name: 'Flinders Lane', y: 446, kind: 'lane', label: true },
  { name: 'Flinders Street', y: 522, kind: 'road', label: false },
] as const;

const VERTICAL_STREETS = [
  { name: 'Spencer Street', x: 72, kind: 'road', label: false },
  { name: 'King Street', x: 225, kind: 'road', label: false },
  { name: 'William Street', x: 405, kind: 'road', label: true },
  { name: 'Queen Street', x: 552, kind: 'road', label: false },
  { name: 'Elizabeth Street', x: 700, kind: 'road', label: true },
  { name: 'Swanston Street', x: 850, kind: 'road', label: false },
  { name: 'Russell Street', x: 972, kind: 'road', label: false },
] as const;

type AmenityGroupView = [number, number, number, number];

function markerStyle(
  position: [number, number],
  viewBox: AmenityGroupView,
  mobilePosition: [number, number] = position,
) {
  const [viewX, viewY, viewWidth, viewHeight] = viewBox;
  return {
    '--marker-x': `${((position[0] - viewX) / viewWidth) * 100}%`,
    '--marker-y': `${((position[1] - viewY) / viewHeight) * 100}%`,
    '--marker-mobile-x': `${((mobilePosition[0] - viewX) / viewWidth) * 100}%`,
    '--marker-mobile-y': `${((mobilePosition[1] - viewY) / viewHeight) * 100}%`,
  } as CSSProperties;
}

function MapBackground({ viewBox, radius }: { viewBox: AmenityGroupView; radius: number }) {
  return (
    <svg
      className="amenity-map-artwork"
      viewBox={viewBox.join(' ')}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect className="amenity-map-ground" x="0" y="0" width="1000" height="700" />
      <path className="amenity-map-water" d="M0 605C170 570 305 624 462 607C623 589 767 552 1000 582V700H0Z" />
      <path className="amenity-map-park" d="M118 28H335V145H118Z" />
      <g className="amenity-map-roads">
        {HORIZONTAL_STREETS.map((street) => (
          <line className={`amenity-map-road is-${street.kind}`} x1="0" x2="1000" y1={street.y} y2={street.y} key={street.name} />
        ))}
        {VERTICAL_STREETS.map((street) => (
          <line className={`amenity-map-road is-${street.kind}`} x1={street.x} x2={street.x} y1="0" y2="610" key={street.name} />
        ))}
        <path className="amenity-map-road is-road" d="M20 680L225 522" />
        <path className="amenity-map-road is-lane" d="M775 0L790 610" />
      </g>
      <g className="amenity-map-labels">
        {HORIZONTAL_STREETS.filter((street) => street.label).map((street) => (
          <text x="575" y={street.y - 10} key={street.name}>{street.name}</text>
        ))}
        {VERTICAL_STREETS.filter((street) => street.label).map((street) => (
          <text transform={`translate(${street.x - 10} 285) rotate(-90)`} key={street.name}>{street.name}</text>
        ))}
      </g>
      <circle className="amenity-map-radius" cx={BUILDING_POSITION[0]} cy={BUILDING_POSITION[1]} r={radius} />
    </svg>
  );
}

function AmenityMarker({ place, index, viewBox, active, onActivate, onPreview, onPreviewEnd }: {
  place: AmenityPlace;
  index: number;
  viewBox: AmenityGroupView;
  active: boolean;
  onActivate: () => void;
  onPreview: () => void;
  onPreviewEnd: () => void;
}) {
  return (
    <button
      className={`amenity-map-marker${active ? ' is-active' : ''}`}
      type="button"
      style={markerStyle(place.position, viewBox, place.mobilePosition)}
      aria-label={`${index + 1}. ${place.name}, ${place.category}, ${place.walk}`}
      aria-pressed={active}
      onClick={onActivate}
      onMouseEnter={onPreview}
      onMouseLeave={onPreviewEnd}
      onFocus={onPreview}
      onBlur={onPreviewEnd}
    >
      {index + 1}
    </button>
  );
}

function AmenityMapLayer({
  group,
  activePlaceId,
  interactive,
  phase,
  onSelect,
  onPreview,
  onPreviewEnd,
}: {
  group: AmenityGroup;
  activePlaceId: string | null;
  interactive: boolean;
  phase: 'stable' | 'entering' | 'exiting';
  onSelect?: (placeId: string) => void;
  onPreview?: (placeId: string) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div className={`amenity-map-layer is-${phase}`} aria-hidden={!interactive}>
      <MapBackground viewBox={group.viewBox} radius={group.radius} />
      <div className="amenity-building-marker" style={markerStyle(BUILDING_POSITION, group.viewBox)}>
        <span>470</span>
        Collins St
      </div>
      {group.places.map((place, index) => interactive ? (
        <AmenityMarker
          key={place.id}
          place={place}
          index={index}
          viewBox={group.viewBox}
          active={activePlaceId === place.id}
          onActivate={() => onSelect?.(place.id)}
          onPreview={() => onPreview?.(place.id)}
          onPreviewEnd={() => onPreviewEnd?.()}
        />
      ) : (
        <span
          className={`amenity-map-marker is-static${activePlaceId === place.id ? ' is-active' : ''}`}
          style={markerStyle(place.position, group.viewBox, place.mobilePosition)}
          key={place.id}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

export function NearbyAmenities() {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [previousGroupIndex, setPreviousGroupIndex] = useState<number | null>(null);
  const [previousPlaceId, setPreviousPlaceId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(amenityGroups[0].places[0].id);
  const [previewPlaceId, setPreviewPlaceId] = useState<string | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const group = amenityGroups[activeGroupIndex];
  const previousGroup = previousGroupIndex === null ? null : amenityGroups[previousGroupIndex];
  const activePlace = group.places.find((place) => place.id === (previewPlaceId ?? selectedPlaceId))
    ?? group.places[0];

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-place-id="${selectedPlaceId}"]`);
    if (!list || !item) return;
    list.scrollTo({ left: item.offsetLeft - list.offsetLeft, behavior: 'smooth' });
  }, [activeGroupIndex, selectedPlaceId]);

  const selectGroup = (index: number) => {
    if (index === activeGroupIndex) return;
    const nextGroup = amenityGroups[index];
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    setPreviousGroupIndex(activeGroupIndex);
    setPreviousPlaceId(activePlace.id);
    setActiveGroupIndex(index);
    setSelectedPlaceId(nextGroup.places[0].id);
    setPreviewPlaceId(null);
    transitionTimer.current = window.setTimeout(() => {
      setPreviousGroupIndex(null);
      setPreviousPlaceId(null);
      transitionTimer.current = null;
    }, 460);
  };

  return (
    <section className="project-amenities section-frame" id="location">
      <div className="project-amenities__visual">
        <div className="project-amenities__map" aria-label={`Interactive map of amenities within ${group.distance} of 470 Collins Street`}>
          {previousGroup && (
            <AmenityMapLayer
              key={`previous-${previousGroup.distance}`}
              group={previousGroup}
              activePlaceId={previousPlaceId}
              interactive={false}
              phase="exiting"
            />
          )}
          <AmenityMapLayer
            key={`current-${group.distance}`}
            group={group}
            activePlaceId={activePlace.id}
            interactive
            phase={previousGroup ? 'entering' : 'stable'}
            onSelect={setSelectedPlaceId}
            onPreview={setPreviewPlaceId}
            onPreviewEnd={() => setPreviewPlaceId(null)}
          />
        </div>
        <div className="project-amenities__map-caption" aria-live="polite">
          <strong>{activePlace.name}</strong>
          <span>{activePlace.category} · {activePlace.walk}</span>
        </div>
      </div>

      <div className="project-amenities__panel">
        <div className="section-rule" />
        <h2>Nearby amenities</h2>
        <div className="project-amenities__tabs" role="tablist" aria-label="Amenity distance">
          {amenityGroups.map((item, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeGroupIndex === index}
              className={activeGroupIndex === index ? 'is-active' : ''}
              onClick={() => selectGroup(index)}
              key={item.distance}
            >
              {item.distance}
            </button>
          ))}
        </div>
        <ol className="project-amenities__list" key={group.distance} ref={listRef}>
          {group.places.map((place, index) => {
            const active = activePlace.id === place.id;
            return (
              <li data-place-id={place.id} key={place.id}>
                <button
                  type="button"
                  className={active ? 'is-active' : ''}
                  aria-pressed={active}
                  aria-label={`${index + 1}. ${place.name}, ${place.category}, ${place.walk}`}
                  onClick={() => setSelectedPlaceId(place.id)}
                  onMouseEnter={() => setPreviewPlaceId(place.id)}
                  onMouseLeave={() => setPreviewPlaceId(null)}
                  onFocus={() => setPreviewPlaceId(place.id)}
                  onBlur={() => setPreviewPlaceId(null)}
                >
                  <span className="project-amenities__number">{index + 1}</span>
                  <span className="project-amenities__place-copy">
                    <strong>{place.name}</strong>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
