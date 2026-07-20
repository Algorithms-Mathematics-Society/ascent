export interface EligibleInstitution {
  id: string;
  canonical_name: string;
  aliases: readonly string[];
  campus: string | null;
  tier: "AUTO_QUALIFY";
  email_domains: readonly string[];
}

function institution(
  id: string,
  canonicalName: string,
  aliases: readonly string[],
  campus: string | null = null,
  emailDomains: readonly string[] = [],
): EligibleInstitution {
  return {
    id,
    canonical_name: canonicalName,
    aliases,
    campus,
    tier: "AUTO_QUALIFY",
    email_domains: emailDomains,
  };
}

/**
 * Confirmed Ascent Winter '26 institution set.
 *
 * Array order mirrors the published list. Selection alone never grants the
 * AUTO path; the registration pipeline records the claim as UNVERIFIED.
 */
export const ELIGIBLE_INSTITUTIONS = [
  institution(
    "iit-bombay",
    "IIT Bombay",
    ["Indian Institute of Technology Bombay", "IITB", "IIT Mumbai"],
    null,
    ["iitb.ac.in"],
  ),
  institution(
    "iit-delhi",
    "IIT Delhi",
    ["Indian Institute of Technology Delhi", "IITD"],
    null,
    ["iitd.ac.in"],
  ),
  institution("iit-madras", "IIT Madras", [
    "Indian Institute of Technology Madras",
    "IITM",
    "IIT Chennai",
  ]),
  institution("iit-kanpur", "IIT Kanpur", [
    "Indian Institute of Technology Kanpur",
    "IITK",
  ]),
  institution("iit-kharagpur", "IIT Kharagpur", [
    "Indian Institute of Technology Kharagpur",
    "IIT KGP",
    "IITKGP",
  ]),
  institution("iit-roorkee", "IIT Roorkee", [
    "Indian Institute of Technology Roorkee",
    "IITR",
  ]),
  institution("iit-guwahati", "IIT Guwahati", [
    "Indian Institute of Technology Guwahati",
    "IITG",
  ]),
  institution("iit-hyderabad", "IIT Hyderabad", [
    "Indian Institute of Technology Hyderabad",
    "IITH",
  ]),
  institution("iit-indore", "IIT Indore", [
    "Indian Institute of Technology Indore",
    "IITI",
  ]),
  institution("iit-mandi", "IIT Mandi", [
    "Indian Institute of Technology Mandi",
    "IITMandi",
  ]),
  institution("iit-bhu-varanasi", "IIT (BHU) Varanasi", [
    "Indian Institute of Technology BHU Varanasi",
    "IIT BHU",
    "IITBHU",
    "Banaras Hindu University",
  ]),
  institution("iit-ropar", "IIT Ropar", [
    "Indian Institute of Technology Ropar",
    "IITRPR",
  ]),
  institution("iit-bhubaneswar", "IIT Bhubaneswar", [
    "Indian Institute of Technology Bhubaneswar",
    "IITBBS",
  ]),
  institution("iit-gandhinagar", "IIT Gandhinagar", [
    "Indian Institute of Technology Gandhinagar",
    "IITGN",
  ]),
  institution("iit-patna", "IIT Patna", [
    "Indian Institute of Technology Patna",
    "IITP",
  ]),
  institution("iit-jodhpur", "IIT Jodhpur", [
    "Indian Institute of Technology Jodhpur",
    "IITJ",
  ]),
  institution("iit-tirupati", "IIT Tirupati", [
    "Indian Institute of Technology Tirupati",
    "IITT",
  ]),
  institution("iit-palakkad", "IIT Palakkad", [
    "Indian Institute of Technology Palakkad",
    "IITPKD",
  ]),
  institution("iit-bhilai", "IIT Bhilai", [
    "Indian Institute of Technology Bhilai",
    "IITBH",
  ]),
  institution("iit-goa", "IIT Goa", [
    "Indian Institute of Technology Goa",
    "IITGOA",
  ]),
  institution("iit-jammu", "IIT Jammu", [
    "Indian Institute of Technology Jammu",
    "IITJMU",
  ]),
  institution("iit-dharwad", "IIT Dharwad", [
    "Indian Institute of Technology Dharwad",
    "IITDH",
  ]),
  institution("iit-ism-dhanbad", "IIT (ISM) Dhanbad", [
    "Indian Institute of Technology Indian School of Mines Dhanbad",
    "IIT ISM",
    "IITISM",
    "ISM Dhanbad",
  ]),
  institution("chennai-mathematical-institute", "Chennai Mathematical Institute", [
    "CMI",
  ]),
  institution(
    "indian-statistical-institute-kolkata",
    "Indian Statistical Institute",
    ["ISI Kolkata", "ISI Calcutta"],
    "Kolkata",
  ),
  institution(
    "indian-statistical-institute-delhi",
    "Indian Statistical Institute",
    ["ISI Delhi", "ISI New Delhi"],
    "Delhi",
  ),
  institution(
    "indian-statistical-institute-bangalore",
    "Indian Statistical Institute",
    ["ISI Bangalore", "ISI Bengaluru"],
    "Bangalore",
  ),
  institution(
    "indian-institute-of-science-bangalore",
    "Indian Institute of Science",
    ["IISc", "IISC Bangalore", "IISC Bengaluru"],
    "Bangalore",
  ),
  institution(
    "iiit-hyderabad",
    "IIIT Hyderabad",
    [
      "International Institute of Information Technology Hyderabad",
      "IIIT-H",
      "IIITH",
    ],
    null,
    ["students.iiit.ac.in"],
  ),
  institution("iiit-delhi", "IIIT Delhi", [
    "Indraprastha Institute of Information Technology Delhi",
    "IIIT-D",
    "IIITD",
  ]),
  institution("iiit-bangalore", "IIIT Bangalore", [
    "International Institute of Information Technology Bangalore",
    "IIIT-B",
    "IIITB",
  ]),
  institution("delhi-technological-university", "Delhi Technological University", [
    "DTU",
    "Delhi College of Engineering",
    "DCE",
  ]),
  institution(
    "netaji-subhas-university-of-technology",
    "Netaji Subhas University of Technology",
    ["NSUT", "Netaji Subhas Institute of Technology", "NSIT"],
  ),
  institution(
    "bits-pilani",
    "BITS Pilani",
    ["Birla Institute of Technology and Science Pilani", "BITS Pilani campus"],
    "Pilani campus",
    ["pilani.bits-pilani.ac.in"],
  ),
  institution(
    "bits-pilani-goa",
    "BITS Pilani",
    [
      "Birla Institute of Technology and Science Goa",
      "BITS Goa",
      "BITS Pilani Goa campus",
    ],
    "Goa campus",
  ),
  institution(
    "bits-pilani-hyderabad",
    "BITS Pilani",
    [
      "Birla Institute of Technology and Science Hyderabad",
      "BITS Hyderabad",
      "BITS Pilani Hyderabad campus",
    ],
    "Hyderabad campus",
  ),
  institution("nit-tiruchirappalli", "NIT Tiruchirappalli", [
    "National Institute of Technology Tiruchirappalli",
    "NIT Trichy",
    "NITT",
  ]),
  institution("nit-warangal", "NIT Warangal", [
    "National Institute of Technology Warangal",
    "NITW",
  ]),
  institution(
    "nit-karnataka-surathkal",
    "NIT Karnataka",
    [
      "National Institute of Technology Karnataka Surathkal",
      "NIT Surathkal",
      "NITK",
    ],
    "Surathkal",
  ),
  institution("nit-rourkela", "NIT Rourkela", [
    "National Institute of Technology Rourkela",
    "NITRKL",
  ]),
] as const satisfies readonly EligibleInstitution[];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchScore(
  institutionEntry: EligibleInstitution,
  normalizedQuery: string,
): number | null {
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const names = [
    institutionEntry.canonical_name,
    institutionEntry.campus
      ? institutionEntry.canonical_name + " " + institutionEntry.campus
      : institutionEntry.canonical_name,
    ...institutionEntry.aliases,
  ].map(normalize);

  let bestScore = Number.POSITIVE_INFINITY;
  for (const name of names) {
    const words = name.split(" ");
    if (name === normalizedQuery) bestScore = Math.min(bestScore, 0);
    else if (name.startsWith(normalizedQuery)) bestScore = Math.min(bestScore, 1);
    else if (words.some((word) => word.startsWith(normalizedQuery))) {
      bestScore = Math.min(bestScore, 2);
    } else if (
      queryTokens.every((token) =>
        words.some((word) => word.startsWith(token)),
      )
    ) {
      bestScore = Math.min(bestScore, 3);
    } else if (name.includes(normalizedQuery)) {
      bestScore = Math.min(bestScore, 4);
    }
  }

  return Number.isFinite(bestScore) ? bestScore : null;
}

export function searchEligibleInstitutions(
  query: string,
  limit = 10,
): EligibleInstitution[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2 || limit <= 0) return [];

  return ELIGIBLE_INSTITUTIONS.map((institutionEntry, index) => ({
    institutionEntry,
    index,
    score: matchScore(institutionEntry, normalizedQuery),
  }))
    .filter(
      (
        candidate,
      ): candidate is {
        institutionEntry: EligibleInstitution;
        index: number;
        score: number;
      } => candidate.score !== null,
    )
    .sort(
      (first, second) =>
        first.score - second.score || first.index - second.index,
    )
    .slice(0, limit)
    .map(({ institutionEntry }) => institutionEntry);
}

export function getEligibleInstitutionById(
  id: string,
): EligibleInstitution | undefined {
  return ELIGIBLE_INSTITUTIONS.find(
    (institutionEntry) => institutionEntry.id === id,
  );
}
