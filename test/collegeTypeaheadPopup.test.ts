import { describe, it, expect } from "vitest";
import { shouldShowPopup } from "@/components/register/CollegeTypeahead";

const open = { isOpen: true, canSearch: true, isLoading: false, resultCount: 0 };

describe("shouldShowPopup", () => {
  it("does not open just to say nothing matched", () => {
    // The regression this guards: the popup is absolutely positioned over the
    // content below, so opening it here covered the "My institution is not
    // listed" control and left an unlisted candidate with no way forward.
    expect(shouldShowPopup(open)).toBe(false);
  });

  it("does not open when the search failed and there is nothing to pick", () => {
    // Same overlay, same control, and here it reads "Continue with this
    // institution name", which matters more because the search is down.
    expect(shouldShowPopup({ ...open, resultCount: 0 })).toBe(false);
  });

  it("opens while a search is running", () => {
    expect(shouldShowPopup({ ...open, isLoading: true })).toBe(true);
  });

  it("opens when there are results to pick", () => {
    expect(shouldShowPopup({ ...open, resultCount: 3 })).toBe(true);
  });

  it("stays shut when the field is closed or cannot search", () => {
    expect(shouldShowPopup({ ...open, isOpen: false, resultCount: 3 })).toBe(false);
    expect(shouldShowPopup({ ...open, canSearch: false, resultCount: 3 })).toBe(false);
    expect(shouldShowPopup({ ...open, isOpen: false, isLoading: true })).toBe(false);
    expect(shouldShowPopup({ ...open, canSearch: false, isLoading: true })).toBe(false);
  });
});
