export type SpaceStatus = 'available' | 'under-offer' | 'leased' | 'unavailable';

export type Suite = {
  id: string;
  name: string;
  status: SpaceStatus;
  area?: string;
  layoutType?: string;
  availability?: string;
  description?: string;
  features?: string[];
};

export type Space = {
  level: number;
  displayLevel: string;
  status: SpaceStatus;
  availabilityLabel: string;
  area?: string;
  suites?: Suite[];
  planId?: string;
};

const fullFloorSuite = (level: number, status: SpaceStatus = 'available'): Suite => ({
  id: `${level}-01`,
  name: `Unit ${level}.01`,
  status,
  area: '740 m²',
  layoutType: 'Whole floor',
  availability: status === 'under-offer' ? 'Under offer' : status === 'leased' ? 'Leased' : 'Available now',
  description: 'An indicative full-floor workplace with flexible open areas, meeting rooms and a central service core.',
  features: ['Private floor', 'Flexible workplace', 'Collins Street outlook'],
});

export const spaces: Space[] = [
  { level: 16, displayLevel: '16', status: 'available', availabilityLabel: 'Available', planId: '16', suites: [fullFloorSuite(16)] },
  { level: 15, displayLevel: '15', status: 'available', availabilityLabel: 'Available', planId: '15', suites: [fullFloorSuite(15)] },
  { level: 14, displayLevel: '14', status: 'under-offer', availabilityLabel: 'Under offer', planId: '14', suites: [fullFloorSuite(14, 'under-offer')] },
  { level: 12, displayLevel: '12', status: 'available', availabilityLabel: 'Available', planId: '12', suites: [fullFloorSuite(12)] },
  {
    level: 10,
    displayLevel: '10',
    status: 'available',
    availabilityLabel: '1 of 2 available',
    planId: '10',
    suites: [
      {
        id: '10a',
        name: 'Unit 10.01',
        status: 'available',
        area: '370 m²',
        layoutType: 'Part floor',
        availability: 'Available now',
        description: 'An indicative part-floor tenancy arranged around a shared central core with adaptable meeting and work zones.',
        features: ['Private arrival', 'Flexible workplace', 'Natural light'],
      },
      { id: '10b', name: 'Unit 10.02', status: 'leased', area: '370 m²', layoutType: 'Part floor', availability: 'Leased' },
    ],
  },
  { level: 9, displayLevel: '09', status: 'available', availabilityLabel: 'Available', planId: '09', suites: [fullFloorSuite(9)] },
  { level: 8, displayLevel: '08', status: 'leased', availabilityLabel: 'Leased', planId: '08', suites: [fullFloorSuite(8, 'leased')] },
];

const offeredByLevel = new Map(spaces.map((space) => [space.level, space]));

export const interactiveSpaces: Space[] = Array.from({ length: 14 }, (_, index) => {
  const level = 16 - index;
  return offeredByLevel.get(level) ?? {
    level,
    displayLevel: String(level).padStart(2, '0'),
    status: 'unavailable',
    availabilityLabel: 'Not currently offered',
  };
});

export const spaceByLevel = new Map(interactiveSpaces.map((space) => [space.level, space]));
