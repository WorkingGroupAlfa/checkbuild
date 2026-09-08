export const ASSET_ROOT = '/fortis/470-collins';

export type GallerySlide = {
  image: string;
  alt: string;
};

export type AmenityCategory = 'Dining' | 'Cafés' | 'Transport' | 'Wellness & Clubs' | 'Retail & Parks';

export type AmenityPlace = {
  id: string;
  name: string;
  category: AmenityCategory;
  walk: string;
  description: string;
  position: [number, number];
  mobilePosition?: [number, number];
};

export type AmenityGroup = {
  distance: '250m' | '500m' | '1km';
  radius: number;
  viewBox: [number, number, number, number];
  places: AmenityPlace[];
};

export const amenityCategories: AmenityCategory[] = [
  'Dining',
  'Cafés',
  'Transport',
  'Wellness & Clubs',
  'Retail & Parks',
];

export type RelatedProject = {
  name: string;
  address: string;
  image: string;
  href: string;
};

export const gallerySlides: GallerySlide[] = [
  {
    image: 'gallery-restaurant',
    alt: 'A plate being served at a Melbourne restaurant',
  },
  {
    image: 'gallery-station',
    alt: 'Southern Cross Station in central Melbourne',
  },
  {
    image: 'gallery-melbourne',
    alt: 'Melbourne city centre near Collins Street',
  },
];

export const amenityGroups: AmenityGroup[] = [
  {
    distance: '250m',
    radius: 142,
    viewBox: [245, 165, 500, 390],
    places: [
      { id: 'axil', name: 'Axil Coffee Roasters', category: 'Cafés', walk: '2 min walk', description: 'Specialty coffee at Collins Arch, moments from the office.', position: [393, 298] },
      { id: 'mitre', name: 'The Mitre Tavern', category: 'Dining', walk: '3 min walk', description: 'A historic Melbourne tavern tucked into Bank Place.', position: [551, 326] },
      { id: 'mercato', name: 'il Mercato Centrale Melbourne', category: 'Dining', walk: '4 min walk', description: 'Italian food hall, produce market and all-day dining.', position: [342, 409], mobilePosition: [342, 397] },
      { id: 'virgin', name: 'Virgin Active Gym', category: 'Wellness & Clubs', walk: '5 min walk', description: 'Full-service health club with pool, studios and co-working.', position: [340, 442], mobilePosition: [340, 454] },
      { id: 'australian-club', name: 'The Australian Club', category: 'Wellness & Clubs', walk: '3 min walk', description: 'A landmark private club on William Street.', position: [487, 324], mobilePosition: [487, 295] },
      { id: 'vue', name: 'Vue de Monde', category: 'Dining', walk: '4 min walk', description: 'Destination dining with skyline views from the Rialto.', position: [416, 432], mobilePosition: [405, 445] },
    ],
  },
  {
    distance: '500m',
    radius: 222,
    viewBox: [85, 72, 820, 610],
    places: [
      { id: 'southern-cross', name: 'Southern Cross Station', category: 'Transport', walk: '6 min walk', description: 'Metropolitan, regional and airport transport connections.', position: [259, 448] },
      { id: 'rene-la-rue', name: 'Rene & La Rue', category: 'Dining', walk: '6 min walk', description: 'Contemporary French dining in Melbourne’s CBD.', position: [572, 303] },
      { id: 'higher-ground', name: 'Higher Ground', category: 'Cafés', walk: '7 min walk', description: 'All-day café in a dramatic heritage power station.', position: [228, 279] },
      { id: 'racv', name: 'RACV Club', category: 'Wellness & Clubs', walk: '6 min walk', description: 'Business, fitness and hospitality facilities on Bourke Street.', position: [496, 275], mobilePosition: [500, 245] },
      { id: 'patricia', name: 'Patricia Coffee Brewers', category: 'Cafés', walk: '5 min walk', description: 'A compact standing-room espresso bar on Little Bourke Street.', position: [448, 232], mobilePosition: [420, 215] },
    ],
  },
  {
    distance: '1km',
    radius: 302,
    viewBox: [0, 0, 1000, 700],
    places: [
      { id: 'bourke-mall', name: 'Bourke Street Mall', category: 'Retail & Parks', walk: '11 min walk', description: 'Melbourne’s central pedestrian retail precinct.', position: [632, 255], mobilePosition: [650, 235] },
      { id: 'flinders-station', name: 'Flinders Street Station', category: 'Transport', walk: '13 min walk', description: 'Major rail interchange at the centre of the city network.', position: [689, 405] },
      { id: 'town-hall', name: 'Town Hall Station', category: 'Transport', walk: '12 min walk', description: 'New underground connection beneath Swanston Street.', position: [661, 309], mobilePosition: [615, 325] },
      { id: 'melbourne-central', name: 'Melbourne Central Station', category: 'Transport', walk: '14 min walk', description: 'Rail, tram and retail connections at the northern CBD.', position: [546, 147] },
      { id: 'flagstaff', name: 'Flagstaff Gardens', category: 'Retail & Parks', walk: '10 min walk', description: 'Established lawns and mature trees at the city’s western edge.', position: [374, 146] },
      { id: 'gimlet', name: 'Gimlet', category: 'Dining', walk: '12 min walk', description: 'European dining and cocktails in Cavendish House.', position: [746, 316] },
    ],
  },
];

export const relatedProjects: RelatedProject[] = [
  {
    name: 'Richmond Square',
    address: '1–5 Wiltshire Street, Richmond, VIC',
    image: 'related-richmond',
    href: 'https://www.fortis.com.au/projects/richmond-square/',
  },
  {
    name: 'The Gild Commercial',
    address: '61–73 Fitzroy Street, St Kilda, VIC',
    image: 'related-gild',
    href: 'https://www.fortis.com.au/projects/the-gild-commercial/',
  },
  {
    name: '122 Moray',
    address: '122 Moray Street, South Melbourne, VIC',
    image: 'related-moray',
    href: 'https://www.fortis.com.au/projects/122-moray/',
  },
];

export const offices = [
  { city: 'Sydney', lines: ['L5 30–36 Bay St', 'Double Bay', 'NSW 2028'] },
  { city: 'Melbourne', lines: ['L7 122 Moray St', 'South Melbourne', 'VIC 3205'] },
  { city: 'Brisbane', lines: ['L1 The Annex 12 Creek St', 'Brisbane', 'QLD 4000'] },
  { city: 'Adelaide', lines: ['S1, L4 57–69 Wyatt St', 'Adelaide', 'SA 5000'] },
] as const;
