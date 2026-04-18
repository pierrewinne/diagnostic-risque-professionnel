/**
 * NACE Rev. 2.1 Nomenclature for Professional Risk Pool Classification
 *
 * Source: Commission Delegated Regulation (EU) 2023/137 (effective 1 January 2025)
 *         Eurostat SDMX API (NACE_R2 codelist) + Rev 2.1 structural changes
 *         STATEC Luxembourg (NACELUX) — national implementation
 *         Eurostat Business Demography dataset BD_9AC_L_FORM_R2 for Luxembourg
 *
 * NACE Rev. 2.1 structure: 22 Sections (A–V), 87 Divisions (2-digit), 287 Groups, 651 Classes
 *
 * KEY CHANGE from Rev 2 to Rev 2.1:
 *   - Old Section J "Information and communication" was SPLIT into:
 *       New Section J: "Publishing, broadcasting, content production and distribution"
 *       New Section K: "Telecommunication, computer programming, consulting, computing infrastructure
 *                        and other information service activities"
 *   - Old Sections K through U were shifted one letter forward to L through V
 *   - Division 45 (motor vehicle trade) was merged, reducing total from 88 to 87 divisions
 *   - 36 new classes were added at the 4-digit level
 *
 * For insurance risk pooling, the Section + Division level is the primary segmentation.
 * Luxembourg uses NACELUX which mirrors the NACE Rev. 2.1 structure exactly,
 * with additional sub-class detail for Luxembourg-specific activities (e.g., investment funds).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NaceDivision {
  /** 2-digit division code (e.g., "01", "10", "64") */
  code: string;
  /** Official EN label */
  label: string;
  /** Number of active enterprises in Luxembourg (2020, Eurostat BD_9AC_L_FORM_R2) */
  luxembourgEnterprises2020?: number;
}

export interface NaceSection {
  /** 1-letter section code (A–V in Rev 2.1) */
  letter: string;
  /** Official EN label (NACE Rev. 2.1) */
  label: string;
  /** Division range as string, e.g. "01-03" */
  divisionRange: string;
  /** All divisions in this section */
  divisions: NaceDivision[];
  /** Total active enterprises in Luxembourg for this section (2020) */
  luxembourgEnterprises2020?: number;
  /** Risk pool relevance: whether this section is relevant for multi-risk professional insurance */
  insuranceRelevance: 'core' | 'relevant' | 'marginal' | 'excluded';
}

// ---------------------------------------------------------------------------
// Complete NACE Rev. 2.1 Nomenclature
// ---------------------------------------------------------------------------
// Note on section letters: From Section J onward, Rev 2.1 differs from Rev 2.
// The division 2-digit codes themselves are UNCHANGED between Rev 2 and Rev 2.1
// (the numbering system is the same). What changed is only:
//   1. Which section letter a given division belongs to (J-onward shifted)
//   2. Some divisions were merged/split at the 3-digit and 4-digit level
//   3. Labels were updated for some divisions
//
// For risk pooling, we use the Rev 2.1 section letters below.
// The enterprise count data from Eurostat is still coded in Rev 2 letters
// (since 2020 data predates the Rev 2.1 transition). The mapping is:
//   Rev 2 J (Information & communication) -> Rev 2.1 J + K
//   Rev 2 K (Financial) -> Rev 2.1 L
//   Rev 2 L (Real estate) -> Rev 2.1 M
//   Rev 2 M (Professional) -> Rev 2.1 N
//   Rev 2 N (Administrative) -> Rev 2.1 O
//   Rev 2 O (Public admin) -> Rev 2.1 P
//   Rev 2 P (Education) -> Rev 2.1 Q
//   Rev 2 Q (Health) -> Rev 2.1 R
//   Rev 2 R (Arts) -> Rev 2.1 S
//   Rev 2 S (Other services) -> Rev 2.1 T
//   Rev 2 T (Households) -> Rev 2.1 U
//   Rev 2 U (Extraterritorial) -> Rev 2.1 V

export const naceSections: NaceSection[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // SECTION A — Agriculture, forestry and fishing
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'A',
    label: 'Agriculture, forestry and fishing',
    divisionRange: '01-03',
    // Note: Section A not covered by Eurostat business demography (BD covers B-S excl. K64.2/K64.3)
    // Luxembourg has ~1,900 agricultural holdings per Eurostat Farm Structure Survey
    luxembourgEnterprises2020: undefined,
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '01', label: 'Crop and animal production, hunting and related service activities' },
      { code: '02', label: 'Forestry and logging' },
      { code: '03', label: 'Fishing and aquaculture' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION B — Mining and quarrying
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'B',
    label: 'Mining and quarrying',
    divisionRange: '05-09',
    luxembourgEnterprises2020: 8,
    insuranceRelevance: 'marginal',
    divisions: [
      { code: '05', label: 'Mining of coal and lignite' },
      { code: '06', label: 'Extraction of crude petroleum and natural gas' },
      { code: '07', label: 'Mining of metal ores' },
      { code: '08', label: 'Other mining and quarrying' },
      { code: '09', label: 'Mining support service activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION C — Manufacturing
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'C',
    label: 'Manufacturing',
    divisionRange: '10-33',
    luxembourgEnterprises2020: 770,
    insuranceRelevance: 'core',
    divisions: [
      { code: '10', label: 'Manufacture of food products' },
      { code: '11', label: 'Manufacture of beverages' },
      { code: '12', label: 'Manufacture of tobacco products' },
      { code: '13', label: 'Manufacture of textiles' },
      { code: '14', label: 'Manufacture of wearing apparel' },
      { code: '15', label: 'Manufacture of leather and related products' },
      { code: '16', label: 'Manufacture of wood and of products of wood and cork, except furniture; manufacture of articles of straw and plaiting materials' },
      { code: '17', label: 'Manufacture of paper and paper products' },
      { code: '18', label: 'Printing and reproduction of recorded media' },
      { code: '19', label: 'Manufacture of coke and refined petroleum products' },
      { code: '20', label: 'Manufacture of chemicals and chemical products' },
      { code: '21', label: 'Manufacture of basic pharmaceutical products and pharmaceutical preparations' },
      { code: '22', label: 'Manufacture of rubber and plastic products' },
      { code: '23', label: 'Manufacture of other non-metallic mineral products' },
      { code: '24', label: 'Manufacture of basic metals' },
      { code: '25', label: 'Manufacture of fabricated metal products, except machinery and equipment' },
      { code: '26', label: 'Manufacture of computer, electronic and optical products' },
      { code: '27', label: 'Manufacture of electrical equipment' },
      { code: '28', label: 'Manufacture of machinery and equipment n.e.c.' },
      { code: '29', label: 'Manufacture of motor vehicles, trailers and semi-trailers' },
      { code: '30', label: 'Manufacture of other transport equipment' },
      { code: '31', label: 'Manufacture of furniture' },
      { code: '32', label: 'Other manufacturing' },
      { code: '33', label: 'Repair and installation of machinery and equipment' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION D — Electricity, gas, steam and air conditioning supply
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'D',
    label: 'Electricity, gas, steam and air conditioning supply',
    divisionRange: '35',
    luxembourgEnterprises2020: 110,
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '35', label: 'Electricity, gas, steam and air conditioning supply' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION E — Water supply; sewerage, waste management and remediation
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'E',
    label: 'Water supply; sewerage, waste management and remediation activities',
    divisionRange: '36-39',
    luxembourgEnterprises2020: 64,
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '36', label: 'Water collection, treatment and supply' },
      { code: '37', label: 'Sewerage' },
      { code: '38', label: 'Waste collection, treatment and disposal activities; materials recovery' },
      { code: '39', label: 'Remediation activities and other waste management services' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION F — Construction
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'F',
    label: 'Construction',
    divisionRange: '41-43',
    luxembourgEnterprises2020: 4233,
    insuranceRelevance: 'core',
    divisions: [
      { code: '41', label: 'Construction of buildings' },
      { code: '42', label: 'Civil engineering' },
      { code: '43', label: 'Specialised construction activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION G — Wholesale and retail trade; repair of motor vehicles
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'G',
    label: 'Wholesale and retail trade; repair of motor vehicles and motorcycles',
    divisionRange: '45-47',
    luxembourgEnterprises2020: 7348,
    insuranceRelevance: 'core',
    divisions: [
      { code: '45', label: 'Wholesale and retail trade and repair of motor vehicles and motorcycles' },
      { code: '46', label: 'Wholesale trade, except of motor vehicles and motorcycles' },
      { code: '47', label: 'Retail trade, except of motor vehicles and motorcycles' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION H — Transportation and storage
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'H',
    label: 'Transportation and storage',
    divisionRange: '49-53',
    luxembourgEnterprises2020: 1263,
    insuranceRelevance: 'core',
    divisions: [
      { code: '49', label: 'Land transport and transport via pipelines' },
      { code: '50', label: 'Water transport' },
      { code: '51', label: 'Air transport' },
      { code: '52', label: 'Warehousing and support activities for transportation' },
      { code: '53', label: 'Postal and courier activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION I — Accommodation and food service activities
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'I',
    label: 'Accommodation and food service activities',
    divisionRange: '55-56',
    luxembourgEnterprises2020: 2694,
    insuranceRelevance: 'core',
    divisions: [
      { code: '55', label: 'Accommodation' },
      { code: '56', label: 'Food and beverage service activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION J — Publishing, broadcasting, content production & distribution
  //   (NEW in Rev 2.1 — was part of old Section J "Information & communication")
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'J',
    label: 'Publishing, broadcasting and content production and distribution activities',
    divisionRange: '58-60',
    // Rev 2 Section J had 2,731 enterprises total (divisions 58-63 combined)
    // Approximate split: J(new) ~500, K(new) ~2,231 based on EU-wide ratios
    luxembourgEnterprises2020: undefined, // Cannot disaggregate from Rev 2 data
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '58', label: 'Publishing activities' },
      { code: '59', label: 'Motion picture, video and television programme production, sound recording and music publishing activities' },
      { code: '60', label: 'Programming and broadcasting activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION K — Telecommunication, computer programming, consulting,
  //              computing infrastructure and other information services
  //   (NEW in Rev 2.1 — was part of old Section J "Information & communication")
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'K',
    label: 'Telecommunication, computer programming, consulting, computing infrastructure and other information service activities',
    divisionRange: '61-63',
    // Rev 2 Section J had 2,731 enterprises total
    luxembourgEnterprises2020: undefined, // Cannot disaggregate from Rev 2 data
    insuranceRelevance: 'core',
    divisions: [
      { code: '61', label: 'Telecommunications' },
      { code: '62', label: 'Computer programming, consultancy and related activities' },
      { code: '63', label: 'Information service activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION L — Financial and insurance activities
  //   (was Section K in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'L',
    label: 'Financial and insurance activities',
    divisionRange: '64-66',
    // Section K in Rev 2 is excluded from BD_9AC_L_FORM_R2 (excl. K64.2/K64.3)
    // Luxembourg has a very large financial sector: ~3,600+ entities per CSSF/CAA data
    luxembourgEnterprises2020: undefined, // Not in Eurostat BD dataset
    insuranceRelevance: 'core',
    divisions: [
      { code: '64', label: 'Financial service activities, except insurance and pension funding' },
      { code: '65', label: 'Insurance, reinsurance and pension funding, except compulsory social security' },
      { code: '66', label: 'Activities auxiliary to financial services and insurance activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION M — Real estate activities
  //   (was Section L in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'M',
    label: 'Real estate activities',
    divisionRange: '68',
    luxembourgEnterprises2020: 3937, // was Rev 2 Section L
    insuranceRelevance: 'core',
    divisions: [
      { code: '68', label: 'Real estate activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION N — Professional, scientific and technical activities
  //   (was Section M in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'N',
    label: 'Professional, scientific and technical activities',
    divisionRange: '69-75',
    luxembourgEnterprises2020: 8108, // was Rev 2 Section M — LARGEST section in Luxembourg
    insuranceRelevance: 'core',
    divisions: [
      { code: '69', label: 'Legal and accounting activities' },
      { code: '70', label: 'Activities of head offices; management consultancy activities' },
      { code: '71', label: 'Architectural and engineering activities; technical testing and analysis' },
      { code: '72', label: 'Scientific research and development' },
      { code: '73', label: 'Advertising and market research' },
      { code: '74', label: 'Other professional, scientific and technical activities' },
      { code: '75', label: 'Veterinary activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION O — Administrative and support service activities
  //   (was Section N in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'O',
    label: 'Administrative and support service activities',
    divisionRange: '77-82',
    luxembourgEnterprises2020: 2322, // was Rev 2 Section N
    insuranceRelevance: 'core',
    divisions: [
      { code: '77', label: 'Rental and leasing activities' },
      { code: '78', label: 'Employment activities' },
      { code: '79', label: 'Travel agency, tour operator and other reservation service and related activities' },
      { code: '80', label: 'Security and investigation activities' },
      { code: '81', label: 'Services to buildings and landscape activities' },
      { code: '82', label: 'Office administrative, office support and other business support activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION P — Public administration and defence; compulsory social security
  //   (was Section O in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'P',
    label: 'Public administration and defence; compulsory social security',
    divisionRange: '84',
    luxembourgEnterprises2020: undefined, // Excluded from BD (public sector)
    insuranceRelevance: 'excluded',
    divisions: [
      { code: '84', label: 'Public administration and defence; compulsory social security' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION Q — Education
  //   (was Section P in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'Q',
    label: 'Education',
    divisionRange: '85',
    luxembourgEnterprises2020: 719, // was Rev 2 Section P
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '85', label: 'Education' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION R — Human health and social work activities
  //   (was Section Q in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'R',
    label: 'Human health and social work activities',
    divisionRange: '86-88',
    luxembourgEnterprises2020: 2760, // was Rev 2 Section Q
    insuranceRelevance: 'core',
    divisions: [
      { code: '86', label: 'Human health activities' },
      { code: '87', label: 'Residential care activities' },
      { code: '88', label: 'Social work activities without accommodation' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION S — Arts, sports and recreation
  //   (was Section R in Rev 2)
  //   Note: Rev 2.1 renamed this from "Arts, entertainment and recreation"
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'S',
    label: 'Arts, sports and recreation',
    divisionRange: '90-93',
    luxembourgEnterprises2020: 726, // was Rev 2 Section R
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '90', label: 'Creative, arts and entertainment activities' },
      { code: '91', label: 'Libraries, archives, museums and other cultural activities' },
      { code: '92', label: 'Gambling and betting activities' },
      { code: '93', label: 'Sports activities and amusement and recreation activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION T — Other service activities
  //   (was Section S in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'T',
    label: 'Other service activities',
    divisionRange: '94-96',
    luxembourgEnterprises2020: 1524, // was Rev 2 Section S
    insuranceRelevance: 'relevant',
    divisions: [
      { code: '94', label: 'Activities of membership organisations' },
      { code: '95', label: 'Repair of computers and personal and household goods' },
      { code: '96', label: 'Other personal service activities' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION U — Activities of households as employers
  //   (was Section T in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'U',
    label: 'Activities of households as employers; undifferentiated goods- and services-producing activities of households for own use',
    divisionRange: '97-98',
    luxembourgEnterprises2020: undefined,
    insuranceRelevance: 'excluded',
    divisions: [
      { code: '97', label: 'Activities of households as employers of domestic personnel' },
      { code: '98', label: 'Undifferentiated goods- and services-producing activities of private households for own use' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION V — Activities of extraterritorial organisations and bodies
  //   (was Section U in Rev 2)
  // ═══════════════════════════════════════════════════════════════════════
  {
    letter: 'V',
    label: 'Activities of extraterritorial organisations and bodies',
    divisionRange: '99',
    luxembourgEnterprises2020: undefined,
    insuranceRelevance: 'excluded',
    divisions: [
      { code: '99', label: 'Activities of extraterritorial organisations and bodies' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Convenience lookups
// ---------------------------------------------------------------------------

/** Map from section letter to NaceSection */
export const sectionByLetter = new Map<string, NaceSection>(
  naceSections.map((s) => [s.letter, s]),
);

/** Map from division code to NaceDivision (with parent section letter) */
export const divisionByCode = new Map<string, NaceDivision & { sectionLetter: string }>(
  naceSections.flatMap((s) =>
    s.divisions.map((d) => [d.code, { ...d, sectionLetter: s.letter }] as const),
  ),
);

/** Only sections relevant for professional insurance (core + relevant) */
export const insurableSections = naceSections.filter(
  (s) => s.insuranceRelevance === 'core' || s.insuranceRelevance === 'relevant',
);

// ---------------------------------------------------------------------------
// Luxembourg enterprise distribution (2020, Eurostat BD_9AC_L_FORM_R2)
// ---------------------------------------------------------------------------
// These are NACE Rev 2 section letters mapped to Rev 2.1 letters above.
// Total (B-S excl. K64.2/K64.3): 40,997 active enterprises
// Missing from this dataset: Section A (agriculture), K/L (financial), O/P (public admin),
//   T/U (households), V (extraterritorial)
//
// For insurance product sizing, the key insight is:
//   - Professional/scientific/technical (N in Rev 2.1): 8,108 — 19.8% — LARGEST
//   - Wholesale & retail trade (G): 7,348 — 17.9%
//   - Construction (F): 4,233 — 10.3%
//   - Real estate (M in Rev 2.1): 3,937 — 9.6%
//   - Information & communication (J+K in Rev 2.1): 2,731 — 6.7%
//   - Health & social work (R in Rev 2.1): 2,760 — 6.7%
//   - Accommodation & food (I): 2,694 — 6.6%
//   - Administrative support (O in Rev 2.1): 2,322 — 5.7%
//   - Other services (T in Rev 2.1): 1,524 — 3.7%
//   - Transportation (H): 1,263 — 3.1%
//   - Manufacturing (C): 770 — 1.9%
//   - Arts/recreation (S in Rev 2.1): 726 — 1.8%
//   - Education (Q in Rev 2.1): 719 — 1.8%
//   - Electricity/gas (D): 110 — 0.3%
//   - Water/waste (E): 64 — 0.2%
//   - Mining (B): 8 — 0.0%
//
// Financial sector (not in BD): estimated ~3,600+ entities (CSSF/CAA regulated)
// Agriculture: ~1,900 holdings (Farm Structure Survey)

export const luxembourgEnterpriseSummary = {
  year: 2020,
  source: 'Eurostat BD_9AC_L_FORM_R2 (V11910)',
  totalBusinessEconomy: 40997, // B-S excl. K64.2/K64.3
  totalIncludingEstimates: 46500, // rough estimate including agriculture + financial + other
  bySection: [
    { rev21Letter: 'B', label: 'Mining and quarrying', count: 8, pct: 0.0 },
    { rev21Letter: 'C', label: 'Manufacturing', count: 770, pct: 1.9 },
    { rev21Letter: 'D', label: 'Electricity, gas, steam', count: 110, pct: 0.3 },
    { rev21Letter: 'E', label: 'Water supply, waste', count: 64, pct: 0.2 },
    { rev21Letter: 'F', label: 'Construction', count: 4233, pct: 10.3 },
    { rev21Letter: 'G', label: 'Wholesale and retail trade', count: 7348, pct: 17.9 },
    { rev21Letter: 'H', label: 'Transportation and storage', count: 1263, pct: 3.1 },
    { rev21Letter: 'I', label: 'Accommodation and food', count: 2694, pct: 6.6 },
    { rev21Letter: 'J+K', label: 'Information and communication (combined)', count: 2731, pct: 6.7 },
    { rev21Letter: 'M', label: 'Real estate', count: 3937, pct: 9.6 },
    { rev21Letter: 'N', label: 'Professional, scientific, technical', count: 8108, pct: 19.8 },
    { rev21Letter: 'O', label: 'Administrative and support', count: 2322, pct: 5.7 },
    { rev21Letter: 'Q', label: 'Education', count: 719, pct: 1.8 },
    { rev21Letter: 'R', label: 'Human health and social work', count: 2760, pct: 6.7 },
    { rev21Letter: 'S', label: 'Arts, sports and recreation', count: 726, pct: 1.8 },
    { rev21Letter: 'T', label: 'Other service activities', count: 1524, pct: 3.7 },
  ],
};

// ---------------------------------------------------------------------------
// Key changes NACE Rev 2 -> Rev 2.1 (summary for reference)
// ---------------------------------------------------------------------------

export const naceRev21Changes = {
  effectiveDate: '2025-01-01',
  regulation: 'Commission Delegated Regulation (EU) 2023/137 of 10 October 2022',
  structuralSummary: {
    sections: { rev2: 21, rev21: 22, change: '+1 (J split into J+K)' },
    divisions: { rev2: 88, rev21: 87, change: '-1 (Division 45 merged into G)' },
    groups: { rev2: 272, rev21: 287, change: '+15' },
    classes: { rev2: 615, rev21: 651, change: '+36' },
  },
  majorChanges: [
    'Section J "Information and communication" split into: J (Publishing, broadcasting, content) and K (Telecom, IT, computing)',
    'All sections from old K onward shifted one letter forward (K->L, L->M, ..., U->V)',
    'New classes added for: e-commerce, cloud computing, data processing, platform economy, renewable energy',
    'Revised rules for outsourcing classification',
    'New treatment of intermediation activities (e.g., platform-based services)',
    'Division 45 (motor vehicle trade) scope adjusted',
    'Section S renamed from "Arts, entertainment and recreation" to "Arts, sports and recreation"',
  ],
  luxembourgTransition: {
    authority: 'STATEC (Institut national de la statistique et des études économiques)',
    nationalVersion: 'NACELUX',
    codeAssignment: 'STATEC assigns codes independently upon RCS registration',
    verification: 'Companies can check their code on MyGuichet.lu',
    modification: 'Contact STATEC with documented justification to change code',
    specificities: [
      'NACELUX adds sub-class detail for Luxembourg-specific financial activities',
      'Investment fund management has specialized NACELUX sub-classes',
      'Cross-border financial services have additional coding precision',
      'NACE code determines Chamber of Commerce contributions and regulatory oversight',
    ],
  },
  transitionTimeline: [
    { date: '2023-02-09', event: 'Regulation entered into force' },
    { date: '2025-01-01', event: 'First statistical domains start using Rev 2.1' },
    { date: '2025-2031', event: 'Incremental roll-out across all statistical domains' },
    { date: '2026', event: 'Business registers expected to complete transition' },
  ],
};
