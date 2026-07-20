import { describe, expect, it } from "vitest";
import {
  ELIGIBLE_INSTITUTIONS,
  getEligibleInstitutionById,
  searchEligibleInstitutions,
} from "../src/content/institutions";

const EXPECTED_DISPLAY_NAMES = [
  "IIT Bombay",
  "IIT Delhi",
  "IIT Madras",
  "IIT Kanpur",
  "IIT Kharagpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT Hyderabad",
  "IIT Indore",
  "IIT Mandi",
  "IIT (BHU) Varanasi",
  "IIT Ropar",
  "IIT Bhubaneswar",
  "IIT Gandhinagar",
  "IIT Patna",
  "IIT Jodhpur",
  "IIT Tirupati",
  "IIT Palakkad",
  "IIT Bhilai",
  "IIT Goa",
  "IIT Jammu",
  "IIT Dharwad",
  "IIT (ISM) Dhanbad",
  "Chennai Mathematical Institute",
  "Indian Statistical Institute, Kolkata",
  "Indian Statistical Institute, Delhi",
  "Indian Statistical Institute, Bangalore",
  "Indian Institute of Science, Bangalore",
  "IIIT Hyderabad",
  "IIIT Delhi",
  "IIIT Bangalore",
  "Delhi Technological University",
  "Netaji Subhas University of Technology",
  "BITS Pilani, Pilani campus",
  "BITS Pilani, Goa campus",
  "BITS Pilani, Hyderabad campus",
  "NIT Tiruchirappalli",
  "NIT Warangal",
  "NIT Karnataka, Surathkal",
  "NIT Rourkela",
];

function displayName(
  institution: (typeof ELIGIBLE_INSTITUTIONS)[number],
): string {
  return institution.campus
    ? institution.canonical_name + ", " + institution.campus
    : institution.canonical_name;
}

describe("eligible institutions", () => {
  it("contains the exact confirmed 40-entry list in published order", () => {
    expect(ELIGIBLE_INSTITUTIONS.map(displayName)).toEqual(
      EXPECTED_DISPLAY_NAMES,
    );
  });

  it("uses unique stable IDs and the confirmed auto-qualify tier", () => {
    const ids = ELIGIBLE_INSTITUTIONS.map((institution) => institution.id);

    expect(new Set(ids).size).toBe(40);
    expect(
      ELIGIBLE_INSTITUTIONS.every(
        (institution) => institution.tier === "AUTO_QUALIFY",
      ),
    ).toBe(true);
  });

  it.each([
    ["iitb", "iit-bombay"],
    ["IIT BHU", "iit-bhu-varanasi"],
    ["ism dhanbad", "iit-ism-dhanbad"],
    ["cmi", "chennai-mathematical-institute"],
    ["iisc", "indian-institute-of-science-bangalore"],
    ["isi delhi", "indian-statistical-institute-delhi"],
    ["bits goa", "bits-pilani-goa"],
    ["nsit", "netaji-subhas-university-of-technology"],
    ["nit trichy", "nit-tiruchirappalli"],
    ["surathkal", "nit-karnataka-surathkal"],
  ])("resolves %s to %s", (query, expectedId) => {
    expect(searchEligibleInstitutions(query)[0]?.id).toBe(expectedId);
  });

  it("returns the same canonical entry used by registration validation", () => {
    expect(getEligibleInstitutionById("bits-pilani-hyderabad")).toMatchObject({
      canonical_name: "BITS Pilani",
      campus: "Hyderabad campus",
      tier: "AUTO_QUALIFY",
    });
  });
});
