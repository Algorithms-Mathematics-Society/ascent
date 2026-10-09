"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  ADMIN_EXPORT_COLUMNS,
  ADMIN_EXPORT_DEFAULT_COLUMNS,
  type AdminExportColumnKey,
  type AdminExportScope,
} from "@/lib/adminExport";

export interface AdminExportCarriedParam {
  name: string;
  value: string;
}

const EXPORT_ACTION = "/api/admin/registrations/export";

/**
 * Column and scope picker for the registrations CSV.
 *
 * This is a plain GET form, not a scripted popover. Submitting it navigates the
 * browser straight to the export route, so the download works with JavaScript
 * switched off or still loading, and the resulting URL is a shareable export
 * link. The React state here only drives the live summary line and the personal
 * data notice: every input is an uncontrolled form control with a name, so the
 * form still submits the right thing if hydration never happens.
 */
export default function AdminExportPicker({
  exportHref,
  columns,
  scope,
  carried,
  loadedCount,
  filteredCount,
}: {
  exportHref: string;
  columns: readonly AdminExportColumnKey[];
  scope: AdminExportScope;
  carried: readonly AdminExportCarriedParam[];
  loadedCount: number;
  filteredCount: number;
}) {
  const [selected, setSelected] = useState<readonly AdminExportColumnKey[]>(
    () => [...columns],
  );
  const [draftScope, setDraftScope] = useState<AdminExportScope>(scope);

  const personalCount = ADMIN_EXPORT_COLUMNS.filter(
    (column) => column.personal && selected.includes(column.key),
  ).length;
  const savedScopeLabel =
    scope === "ALL" ? "all registrants" : "the current filter";
  const draftRowCount = draftScope === "ALL" ? loadedCount : filteredCount;
  // Canonical order on both sides, so a reorder is not mistaken for a change.
  const draftSelection = ADMIN_EXPORT_COLUMNS.filter((column) =>
    selected.includes(column.key),
  )
    .map((column) => column.key)
    .join(",");
  const unsavedChoice =
    draftSelection !== [...columns].join(",") || draftScope !== scope;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        href={exportHref}
        variant="secondary"
        className="min-h-9 px-3 py-2 text-xs"
      >
        Export {savedScopeLabel} · {columns.length}{" "}
        {columns.length === 1 ? "column" : "columns"} · CSV
      </Button>

      <details className="w-full sm:w-auto">
        <summary className="cursor-pointer list-none text-xs font-semibold text-ascent-brand marker:hidden">
          Choose columns and scope <span aria-hidden="true">↓</span>
        </summary>

        <form
          method="get"
          action={EXPORT_ACTION}
          className="mt-3 w-full border border-ascent-border bg-ascent-surface-subtle p-4 text-left sm:w-[34rem]"
        >
          {/*
            The admin list's filters travel with the form so that choosing the
            "current filter" scope exports exactly today's filtered and sorted
            view, and so that saving the choice back to /admin keeps the view.
          */}
          {carried.map((param) => (
            <input
              key={`${param.name}:${param.value}`}
              type="hidden"
              name={param.name}
              value={param.value}
            />
          ))}

          <fieldset className="border-0 p-0">
            <legend className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted">
              Which registrants
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 border border-ascent-border bg-ascent-surface px-3 py-2.5 text-xs leading-5 text-ascent-ink">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  defaultChecked={scope === "ALL"}
                  onChange={() => setDraftScope("ALL")}
                  className="mt-0.5 h-4 w-4 accent-ascent-brand"
                />
                <span>
                  <span className="font-semibold">All registrants</span>
                  <span className="mt-1 block text-ascent-muted">
                    Every entry regardless of approval state. {loadedCount}{" "}
                    loaded.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 border border-ascent-border bg-ascent-surface px-3 py-2.5 text-xs leading-5 text-ascent-ink">
                <input
                  type="radio"
                  name="scope"
                  value="filter"
                  defaultChecked={scope === "FILTERED"}
                  onChange={() => setDraftScope("FILTERED")}
                  className="mt-0.5 h-4 w-4 accent-ascent-brand"
                />
                <span>
                  <span className="font-semibold">Current filter only</span>
                  <span className="mt-1 block text-ascent-muted">
                    The search, decision, route and tag filters above.{" "}
                    {filteredCount} matching.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-4 border-0 p-0">
            <legend className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted">
              Which columns
            </legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {ADMIN_EXPORT_COLUMNS.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2.5 px-1 py-1 text-xs leading-5 text-ascent-ink"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column.key}
                    defaultChecked={columns.includes(column.key)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, column.key]
                          : current.filter((key) => key !== column.key),
                      )
                    }
                    className="h-4 w-4 shrink-0 accent-ascent-brand"
                  />
                  <span>
                    {column.header}
                    {column.personal ? (
                      <span className="ml-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ascent-muted">
                        personal
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="mt-3 text-xs leading-5 text-ascent-muted">
            {selected.length
              ? `${selected.length} ${
                  selected.length === 1 ? "column" : "columns"
                } ticked, about ${draftRowCount} ${
                  draftRowCount === 1 ? "row" : "rows"
                }. Columns always follow the order shown here.`
              : `Nothing ticked, so the export falls back to the default columns: ${ADMIN_EXPORT_DEFAULT_COLUMNS.length} of them.`}
          </p>

          {unsavedChoice ? (
            <p className="mt-2 text-xs leading-5 text-ascent-ink">
              Download CSV below uses the ticks above. The button at the top of
              this panel keeps using the saved choice until you save.
            </p>
          ) : null}

          {personalCount ? (
            <p className="mt-2 border-l-2 border-ascent-brand bg-ascent-brand-tint px-3 py-2 text-xs leading-5 text-ascent-ink">
              This export includes {personalCount} personal data{" "}
              {personalCount === 1 ? "column" : "columns"}. Keep the file only
              as long as the task needs it.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" className="min-h-9 px-3 py-2 text-xs">
              Download CSV
            </Button>
            <Button
              type="submit"
              formAction="/admin"
              variant="secondary"
              className="min-h-9 px-3 py-2 text-xs"
            >
              Save choice to page link
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-ascent-muted">
            Saving puts the choice in this page&apos;s address, so the link can
            be shared or bookmarked and reproduces the same export.
          </p>
        </form>
      </details>
    </div>
  );
}
