import { adminDb } from "../src/lib/firebaseAdmin";
import { buildSearchTerms } from "../src/lib/collegeSearch";

interface SeedCollege {
  id: string;
  canonical_name: string;
  aliases: string[];
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
  email_domains: string[];
}

const SEED_COLLEGES: SeedCollege[] = [
  {
    id: "iit-bombay",
    canonical_name: "IIT Bombay",
    aliases: ["Indian Institute of Technology Bombay", "IITB"],
    campus: "Mumbai",
    tier: "AUTO_QUALIFY",
    email_domains: ["iitb.ac.in"],
  },
  {
    id: "iit-delhi",
    canonical_name: "IIT Delhi",
    aliases: ["Indian Institute of Technology Delhi", "IITD"],
    campus: "Delhi",
    tier: "AUTO_QUALIFY",
    email_domains: ["iitd.ac.in"],
  },
  {
    id: "bits-pilani",
    canonical_name: "BITS Pilani",
    aliases: ["Birla Institute of Technology and Science, Pilani"],
    campus: "Pilani",
    tier: "AUTO_QUALIFY",
    email_domains: ["pilani.bits-pilani.ac.in"],
  },
  {
    id: "iiit-hyderabad",
    canonical_name: "IIIT Hyderabad",
    aliases: [
      "International Institute of Information Technology Hyderabad",
      "IIITH",
    ],
    campus: "Hyderabad",
    tier: "AUTO_QUALIFY",
    email_domains: ["students.iiit.ac.in"],
  },
  {
    id: "vit-vellore",
    canonical_name: "VIT Vellore",
    aliases: ["Vellore Institute of Technology"],
    campus: "Vellore",
    tier: "STANDARD",
    email_domains: ["vitstudent.ac.in"],
  },
  {
    id: "thapar-institute",
    canonical_name: "Thapar Institute of Engineering and Technology",
    aliases: ["Thapar University", "TIET"],
    campus: "Patiala",
    tier: "STANDARD",
    email_domains: ["thapar.edu"],
  },
];

async function seed() {
  const batch = adminDb.batch();
  for (const college of SEED_COLLEGES) {
    const ref = adminDb.collection("colleges").doc(college.id);
    batch.set(ref, {
      canonical_name: college.canonical_name,
      canonical_name_lower: college.canonical_name.toLowerCase(),
      search_terms: buildSearchTerms(college.canonical_name, college.aliases),
      aliases: college.aliases,
      campus: college.campus,
      tier: college.tier,
      email_domains: college.email_domains,
      active: true,
    });
  }
  await batch.commit();
  console.log(`Seeded ${SEED_COLLEGES.length} colleges.`);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
