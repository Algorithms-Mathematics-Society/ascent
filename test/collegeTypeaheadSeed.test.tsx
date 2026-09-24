import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import CollegeTypeahead, {
  initialCollegeCommitment,
  type CollegeResult,
} from "@/components/register/CollegeTypeahead";

type TypeaheadProps = Parameters<typeof CollegeTypeahead>[0];

const RESTORED_COLLEGE: CollegeResult = {
  college_id: "college-1",
  canonical_name: "Example Institute of Technology",
  campus: "Mumbai",
  tier: "AUTO_QUALIFY",
};

const BLANK = { selected: null, unlistedName: "", query: "" };

function render(props: Partial<TypeaheadProps> = {}) {
  return renderToStaticMarkup(
    <CollegeTypeahead onSelect={() => {}} onUnlisted={() => {}} {...props} />,
  );
}

describe("institution seed: the decision", () => {
  it("starts blank when there is nothing to restore", () => {
    expect(initialCollegeCommitment()).toEqual(BLANK);
    expect(initialCollegeCommitment(null, "")).toEqual(BLANK);
    expect(initialCollegeCommitment(undefined, undefined)).toEqual(BLANK);
  });

  it("treats an unlisted name of only spaces as nothing to restore", () => {
    expect(initialCollegeCommitment(null, "   ")).toEqual(BLANK);
  });

  it("puts a restored listed institution in the box and keeps it selected", () => {
    expect(initialCollegeCommitment(RESTORED_COLLEGE, "")).toEqual({
      selected: RESTORED_COLLEGE,
      unlistedName: "",
      query: "Example Institute of Technology",
    });
  });

  it("restores an unlisted name, trimmed, into the box and the summary", () => {
    expect(initialCollegeCommitment(null, "  Some Unlisted College  ")).toEqual({
      selected: null,
      unlistedName: "Some Unlisted College",
      query: "Some Unlisted College",
    });
  });

  it("lets a listed institution win over a stale unlisted name", () => {
    expect(
      initialCollegeCommitment(RESTORED_COLLEGE, "Some Unlisted College"),
    ).toEqual({
      selected: RESTORED_COLLEGE,
      unlistedName: "",
      query: "Example Institute of Technology",
    });
  });
});

describe("institution seed: what the candidate sees on the first render", () => {
  it("shows a restored listed institution in the box and in the summary", () => {
    const markup = render({ initialSelection: RESTORED_COLLEGE });

    expect(markup).toContain('value="Example Institute of Technology"');
    expect(markup).toContain("readonly");
    expect(markup).toContain("Official institution");
    // The summary is the proof the candidate is not looking at an empty box.
    expect(markup).toContain("Change institution");
  });

  it("shows a restored unlisted institution as unlisted", () => {
    const markup = render({ initialUnlistedName: "Some Unlisted College" });

    expect(markup).toContain('value="Some Unlisted College"');
    expect(markup).toContain("readonly");
    expect(markup).toContain("Unlisted institution");
    expect(markup).toContain("Change institution");
  });

  it("opens no result list and offers no unlisted prompt while seeded", () => {
    const markup = render({ initialSelection: RESTORED_COLLEGE });

    expect(markup).not.toContain('role="listbox"');
    expect(markup).not.toContain("My institution is not listed");
    expect(markup).not.toContain("Retry institution search");
  });

  it("renders the plain empty box when no institution is seeded", () => {
    const markup = render();

    expect(markup).toContain('value=""');
    expect(markup).not.toContain("readonly");
    expect(markup).not.toContain("Change institution");
    expect(markup).not.toContain("Official institution");
  });

  it("renders the same markup whether the seed props are absent or empty", () => {
    expect(render({ initialSelection: null, initialUnlistedName: "" })).toBe(
      render(),
    );
    expect(
      render({
        disabled: true,
        error: "Select your institution.",
        required: false,
        initialSelection: null,
        initialUnlistedName: "",
      }),
    ).toBe(
      render({
        disabled: true,
        error: "Select your institution.",
        required: false,
      }),
    );
  });

  it("never calls back into the form while rendering a seeded institution", () => {
    const onSelect = vi.fn();
    const onUnlisted = vi.fn();

    renderToStaticMarkup(
      <CollegeTypeahead
        onSelect={onSelect}
        onUnlisted={onUnlisted}
        initialSelection={RESTORED_COLLEGE}
        initialUnlistedName="Some Unlisted College"
      />,
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(onUnlisted).not.toHaveBeenCalled();
  });
});

describe("institution seed: an initial value, never a subscription", () => {
  const source = readFileSync(
    new URL("../src/components/register/CollegeTypeahead.tsx", import.meta.url),
    "utf8",
  );

  /**
   * Every useEffect body in the component, found by matching the parentheses
   * that follow each useEffect call. Server rendering does not run effects, so
   * this is how the effects themselves are held to the rules.
   */
  function effectBodies() {
    const bodies: string[] = [];
    let from = 0;

    for (;;) {
      const call = source.indexOf("useEffect(", from);
      if (call === -1) break;

      let depth = 0;
      let end = call + "useEffect".length;
      for (; end < source.length; end += 1) {
        if (source[end] === "(") depth += 1;
        if (source[end] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }

      bodies.push(source.slice(call, end + 1));
      from = end + 1;
    }

    return bodies;
  }

  it("finds the effects it is about to check", () => {
    const bodies = effectBodies();

    // A scanner that found nothing would pass everything below for free.
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    for (const body of bodies) expect(body.endsWith(")")).toBe(true);
  });

  it("reads the seed props nowhere but the mount initialiser", () => {
    for (const body of effectBodies()) {
      expect(body).not.toContain("initialSelection");
      expect(body).not.toContain("initialUnlistedName");
    }

    // The one read is the lazy initialiser, which React runs on mount only.
    expect(source).toContain(
      "useState(() =>\n    initialCollegeCommitment(initialSelection, initialUnlistedName),\n  )",
    );
  });

  it("pushes nothing back to the form from an effect", () => {
    for (const body of effectBodies()) {
      expect(body).not.toContain("onSelect(");
      expect(body).not.toContain("onUnlisted(");
    }
  });
});
