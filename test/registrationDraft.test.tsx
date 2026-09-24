import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The bot check reaches for a third party widget on mount and is owned by
// another change in flight, so it is stubbed out here. Nothing else in the
// form is mocked.
vi.mock("@/components/security/BotCheck", () => ({
  default: () => null,
}));

import RegistrationForm, {
  DRAFT_STORAGE_KEY,
  clearRegistrationDraft,
  draftStorageAction,
  hasDraftContent,
  parseRegistrationDraft,
  readRegistrationDraft,
  serializeRegistrationDraft,
  writeRegistrationDraft,
  type RegistrationDraft,
} from "@/components/register/RegistrationForm";

const FILLED_DRAFT: RegistrationDraft = {
  step: 3,
  values: {
    legalName: "Asha Menon",
    email: "asha@example.com",
    phone: "9876543210",
    phoneCountryCode: "91",
    educationStage: "UNIVERSITY",
    currentStudyLevel: "",
    graduationYear: "2027",
    linkedinUrl: "linkedin.com/in/asha-menon",
    githubUrl: "github.com/asha-menon",
    codeforcesHandle: "asham",
    resumeUrl: "https://drive.google.com/file/d/abc123/view",
    transcriptUrl: "https://drive.google.com/file/d/def456/view",
    // Both given in memory, neither may ever reach storage.
    contestConsent: true,
    termsAccepted: true,
  },
  selectedCollege: {
    college_id: "college-1",
    canonical_name: "Example Institute of Technology",
    campus: "Mumbai",
    tier: "AUTO_QUALIFY",
  },
  unlistedName: "",
};

const EMPTY_DRAFT: RegistrationDraft = {
  step: 1,
  values: {
    legalName: "",
    email: "",
    phone: "",
    phoneCountryCode: "91",
    educationStage: "",
    currentStudyLevel: "",
    graduationYear: "",
    linkedinUrl: "",
    githubUrl: "",
    codeforcesHandle: "",
    resumeUrl: "",
    transcriptUrl: "",
    contestConsent: false,
    termsAccepted: false,
  },
  selectedCollege: null,
  unlistedName: "",
};

function storedPayload(draft: RegistrationDraft) {
  return JSON.parse(serializeRegistrationDraft(draft)) as Record<string, unknown>;
}

describe("registration draft: what is written", () => {
  it("never writes participation consent or terms acceptance", () => {
    const serialized = serializeRegistrationDraft(FILLED_DRAFT);

    expect(serialized).not.toContain("contestConsent");
    expect(serialized).not.toContain("termsAccepted");

    const values = storedPayload(FILLED_DRAFT).values as Record<string, unknown>;
    expect(Object.keys(values)).not.toContain("contestConsent");
    expect(Object.keys(values)).not.toContain("termsAccepted");
  });

  it("writes only the whitelisted keys, so no token or receipt can leak", () => {
    const payload = storedPayload(FILLED_DRAFT);

    expect(Object.keys(payload).sort()).toEqual([
      "selectedCollege",
      "step",
      "unlistedName",
      "values",
      "version",
    ]);
    expect(Object.keys(payload.values as object).sort()).toEqual([
      "codeforcesHandle",
      "currentStudyLevel",
      "educationStage",
      "email",
      "githubUrl",
      "graduationYear",
      "legalName",
      "linkedinUrl",
      "phone",
      "phoneCountryCode",
      "resumeUrl",
      "transcriptUrl",
    ]);
  });

  it("stamps the payload with the schema version", () => {
    expect(storedPayload(FILLED_DRAFT).version).toBe(1);
  });
});

describe("registration draft: what is restored", () => {
  it("restores every persisted answer, the college and the step", () => {
    const restored = parseRegistrationDraft(
      serializeRegistrationDraft(FILLED_DRAFT),
    );

    expect(restored).toEqual({
      ...FILLED_DRAFT,
      values: {
        ...FILLED_DRAFT.values,
        contestConsent: false,
        termsAccepted: false,
      },
    });
  });

  it("forces consent false even when the stored text claims it was given", () => {
    const tampered = JSON.stringify({
      version: 1,
      step: 3,
      unlistedName: "",
      selectedCollege: null,
      values: {
        ...(storedPayload(FILLED_DRAFT).values as object),
        contestConsent: true,
        termsAccepted: true,
      },
    });

    const restored = parseRegistrationDraft(tampered);

    expect(restored).not.toBeNull();
    expect(restored?.values.contestConsent).toBe(false);
    expect(restored?.values.termsAccepted).toBe(false);
  });

  it("keeps an unlisted institution", () => {
    const draft: RegistrationDraft = {
      ...EMPTY_DRAFT,
      step: 2,
      unlistedName: "Some Unlisted College",
    };

    expect(
      parseRegistrationDraft(serializeRegistrationDraft(draft))?.unlistedName,
    ).toBe("Some Unlisted College");
  });

  it("ignores stray keys rather than restoring them", () => {
    const withJunk = JSON.stringify({
      version: 1,
      step: 1,
      unlistedName: "",
      selectedCollege: null,
      values: {
        ...(storedPayload(EMPTY_DRAFT).values as object),
        submissionToken: "should-not-come-back",
        receipt: { reference: "should-not-come-back" },
      },
    });

    const restored = parseRegistrationDraft(withJunk);

    expect(restored).not.toBeNull();
    expect(Object.keys(restored?.values ?? {}).sort()).toEqual(
      Object.keys(EMPTY_DRAFT.values).sort(),
    );
    expect(JSON.stringify(restored)).not.toContain("should-not-come-back");
  });
});

describe("registration draft: bad stored text is dropped", () => {
  const validValues = storedPayload(FILLED_DRAFT).values as object;

  const rejected: Array<[string, string | null]> = [
    ["nothing stored", null],
    ["empty string", ""],
    ["not JSON at all", "{not json"],
    ["a bare string", '"just a string"'],
    ["an array", "[1,2,3]"],
    ["null", "null"],
    ["no version", JSON.stringify({ step: 1, values: validValues, selectedCollege: null, unlistedName: "" })],
    ["a newer version", JSON.stringify({ version: 2, step: 1, values: validValues, selectedCollege: null, unlistedName: "" })],
    ["an out of range step", JSON.stringify({ version: 1, step: 4, values: validValues, selectedCollege: null, unlistedName: "" })],
    ["a string step", JSON.stringify({ version: 1, step: "3", values: validValues, selectedCollege: null, unlistedName: "" })],
    ["no values object", JSON.stringify({ version: 1, step: 1, selectedCollege: null, unlistedName: "" })],
    [
      "a missing field",
      JSON.stringify({
        version: 1,
        step: 1,
        values: (() => {
          const partial = { ...(validValues as Record<string, unknown>) };
          delete partial.resumeUrl;
          return partial;
        })(),
        selectedCollege: null,
        unlistedName: "",
      }),
    ],
    [
      "a field of the wrong type",
      JSON.stringify({
        version: 1,
        step: 1,
        values: { ...(validValues as Record<string, unknown>), legalName: 42 },
        selectedCollege: null,
        unlistedName: "",
      }),
    ],
    [
      "an unknown education stage",
      JSON.stringify({
        version: 1,
        step: 1,
        values: { ...(validValues as Record<string, unknown>), educationStage: "ASTRONAUT" },
        selectedCollege: null,
        unlistedName: "",
      }),
    ],
    [
      "a malformed college",
      JSON.stringify({
        version: 1,
        step: 2,
        values: validValues,
        selectedCollege: { college_id: "c1", tier: "GOLD" },
        unlistedName: "",
      }),
    ],
    [
      "a non string unlisted name",
      JSON.stringify({ version: 1, step: 1, values: validValues, selectedCollege: null, unlistedName: 7 }),
    ],
  ];

  it.each(rejected)("drops %s", (_label, raw) => {
    expect(parseRegistrationDraft(raw)).toBeNull();
  });

  it("drops an implausibly large payload instead of parsing it", () => {
    const huge = JSON.stringify({
      version: 1,
      step: 1,
      values: { ...(validValues as Record<string, unknown>), legalName: "x".repeat(40_000) },
      selectedCollege: null,
      unlistedName: "",
    });

    expect(huge.length).toBeGreaterThan(20_000);
    expect(parseRegistrationDraft(huge)).toBeNull();
  });
});

describe("registration draft: when there is something worth keeping", () => {
  it("treats an untouched stage one form as nothing to keep", () => {
    expect(hasDraftContent(EMPTY_DRAFT)).toBe(false);
  });

  it("keeps a draft once any answer is typed", () => {
    expect(
      hasDraftContent({
        ...EMPTY_DRAFT,
        values: { ...EMPTY_DRAFT.values, legalName: "A" },
      }),
    ).toBe(true);
  });

  it("keeps a draft once the candidate is past stage one", () => {
    expect(hasDraftContent({ ...EMPTY_DRAFT, step: 2 })).toBe(true);
  });

  it("keeps a draft that only holds an institution", () => {
    expect(
      hasDraftContent({ ...EMPTY_DRAFT, selectedCollege: FILLED_DRAFT.selectedCollege }),
    ).toBe(true);
    expect(hasDraftContent({ ...EMPTY_DRAFT, unlistedName: "Unlisted" })).toBe(true);
  });

  it("does not treat consent alone as a draft, since consent is never stored", () => {
    expect(
      hasDraftContent({
        ...EMPTY_DRAFT,
        values: { ...EMPTY_DRAFT.values, contestConsent: true, termsAccepted: true },
      }),
    ).toBe(false);
  });
});

describe("registration draft: when the draft is written or cleared", () => {
  it("writes nothing before the stored draft has been read back", () => {
    // The mount pass renders with the empty initial state. Writing then would
    // overwrite the very draft the restore effect is about to read.
    expect(draftStorageAction({ draftLoaded: false, hasReceipt: false })).toBe(
      "skip",
    );
    expect(draftStorageAction({ draftLoaded: false, hasReceipt: true })).toBe(
      "skip",
    );
  });

  it("writes once the restore pass has run", () => {
    expect(draftStorageAction({ draftLoaded: true, hasReceipt: false })).toBe(
      "write",
    );
  });

  it("clears the draft once a receipt comes back", () => {
    expect(draftStorageAction({ draftLoaded: true, hasReceipt: true })).toBe(
      "clear",
    );
  });
});

describe("registration draft: talking to sessionStorage", () => {
  function installStorage(overrides: Partial<Storage> = {}) {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      ...overrides,
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { sessionStorage: storage },
    });
    return { storage, store };
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  it("saves under the versioned key and reads the draft back", () => {
    const { store } = installStorage();

    writeRegistrationDraft(FILLED_DRAFT);

    expect([...store.keys()]).toEqual(["ascent:registration-draft:v1"]);
    expect(DRAFT_STORAGE_KEY).toBe("ascent:registration-draft:v1");
    expect(readRegistrationDraft()).toEqual({
      ...FILLED_DRAFT,
      values: {
        ...FILLED_DRAFT.values,
        contestConsent: false,
        termsAccepted: false,
      },
    });
  });

  it("never lands consent in storage, whatever was ticked in memory", () => {
    const { store } = installStorage();

    writeRegistrationDraft(FILLED_DRAFT);

    const raw = store.get(DRAFT_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("contestConsent");
    expect(raw).not.toContain("termsAccepted");
    expect(raw).not.toContain("true");
    expect(readRegistrationDraft()?.values.contestConsent).toBe(false);
    expect(readRegistrationDraft()?.values.termsAccepted).toBe(false);
  });

  it("removes a pristine draft rather than saving an empty one", () => {
    const { store, storage } = installStorage();
    store.set(DRAFT_STORAGE_KEY, "stale");

    writeRegistrationDraft(EMPTY_DRAFT);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("clears the draft on request", () => {
    const { store } = installStorage();
    writeRegistrationDraft(FILLED_DRAFT);

    clearRegistrationDraft();

    expect(store.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("survives a storage that throws, as private modes do", () => {
    const denied = () => {
      throw new DOMException("denied", "SecurityError");
    };
    installStorage({ getItem: denied, setItem: denied, removeItem: denied });

    expect(() => writeRegistrationDraft(FILLED_DRAFT)).not.toThrow();
    expect(() => clearRegistrationDraft()).not.toThrow();
    expect(readRegistrationDraft()).toBeNull();
  });

  it("survives a quota failure on write", () => {
    const { storage } = installStorage({
      setItem: vi.fn(() => {
        throw new DOMException("quota", "QuotaExceededError");
      }),
    });

    expect(() => writeRegistrationDraft(FILLED_DRAFT)).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it("does nothing at all on the server, where there is no window", () => {
    Reflect.deleteProperty(globalThis, "window");

    expect(readRegistrationDraft()).toBeNull();
    expect(() => writeRegistrationDraft(FILLED_DRAFT)).not.toThrow();
    expect(() => clearRegistrationDraft()).not.toThrow();
  });
});

describe("registration draft: hydration safety", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  it("renders the same markup whether or not a draft is stored", () => {
    const withoutStorage = renderToStaticMarkup(
      <RegistrationForm initiallyOpen />,
    );

    const getItem = vi.fn(() => serializeRegistrationDraft(FILLED_DRAFT));
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: { getItem, setItem: vi.fn(), removeItem: vi.fn() },
      },
    });

    const withStorage = renderToStaticMarkup(<RegistrationForm initiallyOpen />);

    // Identical output is the whole hydration guarantee: the render path
    // cannot see storage, so the server HTML and the browser's first render
    // agree.
    expect(withStorage).toBe(withoutStorage);
    expect(getItem).not.toHaveBeenCalled();
    expect(withStorage).not.toContain("Asha Menon");
    expect(withStorage).not.toContain("asha@example.com");
    expect(withStorage).not.toContain("Example Institute of Technology");
  });

  it("renders even when touching storage throws, as it does in private modes", () => {
    const boom = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get sessionStorage(): Storage {
          return boom();
        },
      },
    });

    expect(() =>
      renderToStaticMarkup(<RegistrationForm initiallyOpen />),
    ).not.toThrow();
  });
});
