import { adminDb } from "../src/lib/firebaseAdmin";
import { buildSearchTerms } from "../src/lib/collegeSearch";
import { ELIGIBLE_INSTITUTIONS } from "../src/content/institutions";

const SEED_COLLEGES = ELIGIBLE_INSTITUTIONS;

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
