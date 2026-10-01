import { ScenarioSelect } from "./ScenarioSelect";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useEffect, useId, useRef, useState } from "react";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { calculate, MAX_ROWS, MAX_ONE_OFF } from "../../shared/scenarios";
import {
  editable,
  serialise,
  parseAmount,
  removeRow,
  restoreRow,
  type EditableDraft,
  type EditableRow,
} from "../lib/scenarioDraft";
import { ScenarioAutosave } from "../lib/scenarioAutosave";
import { useNavigationGuard } from "../hooks/NavigationGuard";
import { ConfirmDialog, Icon, PageHeader } from "./ui";
import { getCurrencySymbol } from "../lib/currency";

type Detail = NonNullable<FunctionReturnType<typeof api.scenarios.get>>;
function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    typeof error.data === "string"
  )
    return error.data;
  return "This action could not be completed. Please try again.";
}
export function WhatIfWorkspace() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.scenarios.list,
    {},
    { initialNumItems: 20 },
  );
  const [selected, setSelected] = useState<Id<"scenarios"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"copy" | "empty">("copy");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { navigate } = useNavigationGuard();
  const create = useMutation(api.scenarios.create);
  const start = () =>
    void navigate(() => {
      setSelected(null);
      setCreating(true);
      setName("");
      setMode("copy");
      setError("");
    });
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = await create({ name, mode });
      setSelected(id);
      setCreating(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="whatif-workspace">
      <PageHeader
        title="What-if budgets"
        description="Explore changes to your income and spending, with your actual budget kept separate."
      />
      <div className="scenario-switcher">
        <label htmlFor="scenario-picker">Saved scenarios</label>
        <ScenarioSelect
          id="scenario-picker"
          value={selected ?? ""}
          disabled={busy}
          onChange={(event) => {
            const id = event.target.value as Id<"scenarios">;
            void navigate(() => {
              setSelected(id || null);
              setCreating(false);
            });
          }}
        >
          <option value="">Choose a scenario</option>
          {results.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name} ({item.currency})
            </option>
          ))}
        </ScenarioSelect>
        <button className="btn-primary" onClick={start} disabled={busy}>
          <Icon name="plus" />
          New scenario
        </button>
        {status === "CanLoadMore" ? (
          <button className="btn-secondary" onClick={() => loadMore(20)}>
            Load more
          </button>
        ) : null}
      </div>
      {creating ? (
        <form
          className="surface scenario-create"
          onSubmit={(event) => void handleCreate(event)}
        >
          <h2>Create a scenario</h2>
          <label htmlFor="scenario-create-name">Scenario name</label>
          <input
            id="scenario-create-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="For example, rent the spare room"
          />
          <fieldset>
            <legend>Where would you like to start?</legend>
            <label>
              <input
                type="radio"
                name="scenario-mode"
                checked={mode === "copy"}
                onChange={() => setMode("copy")}
              />
              Copy my budget
            </label>
            <p>Keep a dated copy of your current income and allocations.</p>
            <label>
              <input
                type="radio"
                name="scenario-mode"
                checked={mode === "empty"}
                onChange={() => setMode("empty")}
              />
              Start empty
            </label>
          </fieldset>
          {error ? (
            <p role="alert" className="scenario-error">
              {error}
            </p>
          ) : null}
          <div className="scenario-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create scenario"}
            </button>
          </div>
        </form>
      ) : selected ? (
        <ScenarioLoader key={selected} id={selected} onSelect={setSelected} />
      ) : (
        <section className="surface scenario-empty">
          <Icon name="allocations" />
          <h2>Explore a decision before you make it.</h2>
          <p>
            A new contract, a spare-room rental, a move or a change in spending.
            Start with your budget and see what changes.
          </p>
          <button className="btn-primary" onClick={start}>
            Copy my budget
          </button>
          {status === "LoadingFirstPage" ? (
            <p role="status">Loading scenarios…</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
function ScenarioLoader({
  id,
  onSelect,
}: {
  id: Id<"scenarios">;
  onSelect: (id: Id<"scenarios"> | null) => void;
}) {
  const detail = useQuery(api.scenarios.get, { id });
  const lastDetail = useRef<Detail | null>(null);
  if (detail) lastDetail.current = detail;
  if (!lastDetail.current)
    return detail === null ? (
      <div className="scenario-error">
        <p>This scenario is no longer available.</p>
        <button className="btn-secondary" onClick={() => onSelect(null)}>
          Return to scenarios
        </button>
      </div>
    ) : (
      <p role="status">Opening scenario…</p>
    );
  return (
    <ScenarioEditor
      id={id}
      detail={lastDetail.current}
      deleted={detail === null}
      onSelect={onSelect}
    />
  );
}
function CalculationHelp({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const show = () => {
    clearTimeout(timer.current);
    const rect = trigger.current!.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.min(rect.bottom + 8, window.innerHeight - 180),
    });
    setOpen(true);
  };
  const hideSoon = () => {
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimeout(timer.current);
        setOpen(false);
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      clearTimeout(timer.current);
    };
  }, [open]);
  return (
    <span className="scenario-calculation-help">
      <button
        ref={trigger}
        type="button"
        aria-label={`How ${label} is calculated`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="scenario-calculation-tooltip"
            style={position}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={hideSoon}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}

function ScenarioEditor({
  id,
  detail,
  deleted,
  onSelect,
}: {
  id: Id<"scenarios">;
  detail: Detail;
  deleted: boolean;
  onSelect: (id: Id<"scenarios"> | null) => void;
}) {
  const client = useConvex();
  const save = useMutation(api.scenarios.save);
  const duplicate = useMutation(api.scenarios.duplicate);
  const copyConflict = useMutation(api.scenarios.copyConflict);
  const recoverDeleted = useMutation(api.scenarios.recoverDeleted);
  const remove = useMutation(api.scenarios.remove);
  const { register, navigate, busy: navigating } = useNavigationGuard();
  const [, redraw] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [auto, setAuto] = useState(
    () =>
      new ScenarioAutosave(
        editable(detail.draft),
        detail.scenario.revision,
        (draft) => serialise(draft) !== null,
        async (draft, revision) =>
          save({ id, expectedRevision: revision, draft: serialise(draft)! }),
        () => redraw((value) => value + 1),
        (draft) => JSON.stringify(serialise(draft)),
        () => toast.success("Scenario saved", { id: `scenario-save-${id}` }),
      ),
  );
  useEffect(() => {
    auto.resume();
    const unregister = register(() => auto.flush());
    return () => {
      unregister();
      auto.dispose();
    };
  }, [auto, register]);
  useEffect(() => {
    if (deleted) auto.stopSaving();
  }, [deleted, auto]);
  useEffect(() => {
    auto.receive(editable(detail.draft), detail.scenario.revision);
  }, [detail, auto]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (auto.pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [auto]);
  const draft = auto.draft;
  const selectedSource = draft.income.find(
    (row) => row.key === draft.selectedIncomeRowId,
  )?.projected;
  const parsed = serialise(draft);
  const result = parsed ? calculate(parsed) : null;
  const money = (amount: number) =>
    `${getCurrencySymbol(draft.currency)}${amount.toLocaleString(undefined, { minimumFractionDigits: draft.currency === "JPY" ? 0 : 2, maximumFractionDigits: draft.currency === "JPY" ? 0 : 2 })}`;
  const signed = (amount: number) =>
    `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${money(Math.abs(amount))}`;
  const edit = (next: EditableDraft) => {
    setActionError("");
    auto.edit(next);
  };
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const copyName = () => `${draft.name.slice(0, 73)} (copy)`;
  const duplicateScenario = () =>
    void navigate(async () => {
      await act(async () => {
        onSelect(await duplicate({ id, name: copyName() }));
      });
    });
  const saveSeparately = () =>
    void act(async () => {
      const local = serialise(auto.draft);
      if (!local) {
        setActionError("Complete the names and amounts before saving a copy.");
        return;
      }
      const copy = { id, draft: { ...local, name: copyName() } };
      const newId = deleted
        ? await recoverDeleted({
            ...copy,
            snapshotAt: detail.scenario.snapshotAt,
          })
        : await copyConflict(copy);
      auto.dispose();
      onSelect(newId);
    });
  const reload = async () => {
    const latest = await client.query(api.scenarios.get, { id });
    if (!latest) throw new Error("This scenario is no longer available.");
    auto.dispose();
    setAuto(
      new ScenarioAutosave(
        editable(latest.draft),
        latest.scenario.revision,
        (draft) => serialise(draft) !== null,
        async (draft, revision) =>
          save({ id, expectedRevision: revision, draft: serialise(draft)! }),
        () => redraw((value) => value + 1),
        (draft) => JSON.stringify(serialise(draft)),
        () => toast.success("Scenario saved", { id: `scenario-save-${id}` }),
      ),
    );
    setGeneration((value) => value + 1);
    setReloading(false);
  };
  const updateRow = (
    group: "income" | "budget",
    key: string,
    field: "name" | "amount",
    value: string,
  ) =>
    edit({
      ...draft,
      [group]: draft[group].map((row) =>
        row.key === key && row.projected
          ? { ...row, projected: { ...row.projected, [field]: value } }
          : row,
      ),
    });
  const addRow = (
    group: "income" | "budget",
    category?: "essentials" | "savings",
  ) =>
    edit({
      ...draft,
      [group]: [
        ...draft[group],
        {
          key: crypto.randomUUID(),
          projected: {
            name: "",
            amount: "",
            ...(category ? { category } : {}),
          },
        },
      ],
    });
  const renderRow = (row: EditableRow, group: "income" | "budget") => {
    const amount = row.projected
      ? parseAmount(row.projected.amount, draft.currency)
      : 0;
    const name =
      row.projected?.name ||
      row.removed?.name ||
      row.baseline?.name ||
      "New item";
    const changedName =
      row.baseline && row.projected && row.baseline.name !== row.projected.name;
    return (
      <div
        key={row.key}
        className={`scenario-row ${!row.projected ? "scenario-row-removed" : ""}`}
      >
        <div className="scenario-row-name">
          {row.projected ? (
            <input
              aria-label={`${group === "income" ? "Income source" : "Allocation"} name`}
              value={row.projected.name}
              maxLength={80}
              placeholder={
                group === "income" ? "Income source name" : "Allocation name"
              }
              onChange={(event) =>
                updateRow(group, row.key, "name", event.target.value)
              }
              aria-invalid={!row.projected.name.trim()}
            />
          ) : (
            <strong>{name}</strong>
          )}
          {group === "budget" && row.projected ? (
            <ScenarioSelect
              className="scenario-category"
              aria-label={`Category for ${name}`}
              value={row.projected.category}
              onChange={(event) =>
                edit({
                  ...draft,
                  budget: draft.budget.map((item) =>
                    item.key === row.key && item.projected
                      ? {
                          ...item,
                          projected: {
                            ...item.projected,
                            category: event.target.value as
                              | "essentials"
                              | "savings",
                          },
                        }
                      : item,
                  ),
                })
              }
            >
              <option value="essentials">Spending</option>
              <option value="savings">Savings</option>
            </ScenarioSelect>
          ) : null}
          {changedName ? <small>Originally {row.baseline!.name}</small> : null}
          {row.baseline &&
          row.projected &&
          row.baseline.category !== row.projected.category ? (
            <small>
              Originally{" "}
              {row.baseline.category === "savings" ? "savings" : "spending"}
            </small>
          ) : null}
          {!row.baseline ? (
            <small>Added</small>
          ) : !row.projected ? (
            <small>Removed</small>
          ) : null}
        </div>
        <div className="scenario-cell">
          <span className="scenario-mobile-label">Current</span>
          {row.baseline ? money(row.baseline.amount) : "—"}
        </div>
        <div className="scenario-cell scenario-projection">
          <span className="scenario-mobile-label">What-if</span>
          {row.projected ? (
            <label className="scenario-amount">
              <span aria-hidden="true">
                {getCurrencySymbol(draft.currency)}
              </span>
              <input
                inputMode={draft.currency === "JPY" ? "numeric" : "decimal"}
                aria-label={`${name} monthly amount`}
                aria-invalid={amount === null}
                value={row.projected.amount}
                onChange={(event) =>
                  updateRow(group, row.key, "amount", event.target.value)
                }
              />
            </label>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="scenario-cell">
          <span className="scenario-mobile-label">Change</span>
          {amount !== null ? signed(amount - (row.baseline?.amount ?? 0)) : "—"}
        </div>
        <div className="scenario-row-action">
          {row.projected ? (
            <button
              className="icon-button icon-button-danger"
              aria-label={`Remove ${name}`}
              onClick={() => edit(removeRow(draft, group, row.key))}
            >
              <Icon name="trash" />
            </button>
          ) : (
            <button
              className="scenario-restore"
              onClick={() => edit(restoreRow(draft, group, row.key))}
            >
              Restore
            </button>
          )}
        </div>
      </div>
    );
  };
  const statusText = {
    saved: "",
    dirty: "Unsaved changes",
    saving: "Saving…",
    invalid: "Complete names and valid amounts to save",
    error: "Could not save",
    conflict: "Changes in another tab",
  }[auto.status];
  return (
    <section className="scenario-editor" key={generation}>
      <div className="scenario-editor-header">
        <div>
          <label htmlFor="scenario-name">Scenario name</label>
          <input
            id="scenario-name"
            disabled={busy || navigating || deleting || reloading}
            value={draft.name}
            maxLength={80}
            onChange={(event) => edit({ ...draft, name: event.target.value })}
          />
          <p>
            Snapshot from{" "}
            {new Date(detail.scenario.snapshotAt).toLocaleDateString()}. Monthly
            amounts in {draft.currency}.
          </p>
        </div>
        <div className="scenario-actions">
          <button
            className="btn-primary"
            disabled={
              busy ||
              navigating ||
              deleting ||
              reloading ||
              deleted ||
              !auto.pending ||
              !parsed ||
              auto.status === "saving" ||
              auto.status === "conflict"
            }
            onClick={() => void auto.flush()}
          >
            {auto.status === "saving" ? "Saving…" : "Save changes"}
          </button>
          <button
            className="btn-secondary"
            disabled={busy || navigating}
            onClick={duplicateScenario}
          >
            Duplicate
          </button>
          <button
            className="icon-button icon-button-danger"
            disabled={busy || navigating}
            aria-label="Delete scenario"
            onClick={() => setDeleting(true)}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
      {statusText ? (
        <div
          className={`scenario-save-status ${auto.status === "error" || auto.status === "conflict" ? "scenario-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {statusText}
        </div>
      ) : null}
      {auto.error && !deleted ? (
        <div className="scenario-error" role="alert">
          <p>{auto.error}</p>
          {auto.status === "conflict" ? (
            <div className="scenario-actions">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setReloading(true)}
              >
                Reload saved version
              </button>
              <button
                className="btn-primary"
                disabled={busy || !parsed}
                onClick={saveSeparately}
              >
                Save as a new scenario
              </button>
            </div>
          ) : (
            <button className="btn-secondary" onClick={() => void auto.retry()}>
              Retry save
            </button>
          )}
        </div>
      ) : null}
      {deleted ? (
        <div className="scenario-error" role="alert">
          <p>
            This scenario was deleted in another tab. Your local edits are still
            here.
          </p>
          <div className="scenario-actions">
            <button
              className="btn-primary"
              disabled={busy || !parsed}
              onClick={saveSeparately}
            >
              Save as a new scenario
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setDiscarding(true)}
            >
              Discard edits and return
            </button>
          </div>
          {!parsed ? (
            <p>Complete the names and amounts to save a new scenario.</p>
          ) : null}
        </div>
      ) : null}
      {actionError ? (
        <p className="scenario-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <fieldset
        className="scenario-fields"
        disabled={busy || navigating || deleting || reloading}
      >
        <legend className="sr-only">Projected monthly budget</legend>
        <div className="scenario-layout">
          <div className="surface scenario-comparison">
            <div className="scenario-column-head">
              <span>Monthly plan</span>
              <span>Current</span>
              <span>What-if</span>
              <span>Change</span>
              <span />
            </div>
            {(["income", "spending", "savings"] as const).map((section) => {
              const group = section === "income" ? "income" : "budget";
              const filtered = draft[group].filter(
                (row) =>
                  section === "income" ||
                  (row.projected ?? row.removed ?? row.baseline)?.category ===
                    (section === "savings" ? "savings" : "essentials"),
              );
              return (
                <section className="scenario-group" key={section}>
                  <header>
                    <h2>
                      {section === "income"
                        ? "Income sources"
                        : section === "spending"
                          ? "Spending"
                          : "Savings"}
                    </h2>
                    <button
                      className="scenario-add"
                      disabled={draft[group].length >= MAX_ROWS}
                      onClick={() =>
                        addRow(
                          group,
                          section === "income"
                            ? undefined
                            : section === "savings"
                              ? "savings"
                              : "essentials",
                        )
                      }
                    >
                      <Icon name="plus" />
                      Add{" "}
                      {section === "income"
                        ? "income"
                        : section === "savings"
                          ? "saving"
                          : "spending"}
                    </button>
                  </header>
                  {section === "income" ? (
                    <p className="scenario-help">
                      Expected monthly income after costs and tax. Don’t deduct
                      those costs again in your spending.
                    </p>
                  ) : null}
                  {filtered.length ? (
                    filtered.map((row) => renderRow(row, group))
                  ) : (
                    <p className="scenario-help">
                      No {section === "income" ? "income sources" : section}{" "}
                      yet.
                    </p>
                  )}
                </section>
              );
            })}
            {result ? (
              <div className="scenario-totals">
                {(["income", "spending", "savings", "available"] as const).map(
                  (key) => (
                    <div className="scenario-row" key={key}>
                      <strong>
                        {key === "available"
                          ? "Available after allocations"
                          : `Total ${key}`}
                      </strong>
                      <div className="scenario-cell">
                        <span className="scenario-mobile-label">Current</span>
                        {money(result.baseline[key])}
                      </div>
                      <div className="scenario-cell">
                        <span className="scenario-mobile-label">What-if</span>
                        {money(result.projected[key])}
                      </div>
                      <div className="scenario-cell">
                        <span className="scenario-mobile-label">Change</span>
                        {signed(result.projected[key] - result.baseline[key])}
                      </div>
                      <span />
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="scenario-help" role="status">
                Complete valid names and amounts to see your comparison. Blank
                amounts are not treated as zero.
              </p>
            )}
          </div>
          <aside className="surface scenario-target">
            <h2>What would you need?</h2>
            <label htmlFor="scenario-breathing">
              Money I want left each month
            </label>
            <label className="scenario-amount">
              <span aria-hidden="true">
                {getCurrencySymbol(draft.currency)}
              </span>
              <input
                id="scenario-breathing"
                inputMode={draft.currency === "JPY" ? "numeric" : "decimal"}
                value={draft.breathingRoomAmount}
                onChange={(event) =>
                  edit({ ...draft, breathingRoomAmount: event.target.value })
                }
                aria-invalid={
                  parseAmount(draft.breathingRoomAmount, draft.currency) ===
                  null
                }
              />
            </label>
            <p className="scenario-help">
              Breathing room after spending and planned savings.
            </p>
            {result ? (
              <>
                <dl>
                  <div>
                    <dt>
                      Required monthly income{" "}
                      <CalculationHelp label="required monthly income">
                        Projected spending + planned savings + the money you
                        want left each month. Upfront costs are excluded.
                      </CalculationHelp>
                    </dt>
                    <dd>{money(result.required)}</dd>
                  </div>
                  <div>
                    <dt>
                      Projected monthly income{" "}
                      <CalculationHelp label="projected monthly income">
                        The sum of all active income sources in this scenario,
                        after tax and business costs. Removed sources are
                        excluded.
                      </CalculationHelp>
                    </dt>
                    <dd>{money(result.projected.income)}</dd>
                  </div>
                  <div
                    className={result.difference < 0 ? "scenario-negative" : ""}
                  >
                    <dt>
                      {result.difference < 0
                        ? "Shortfall against your target"
                        : "Above your target"}
                      <CalculationHelp label="the target difference">
                        Projected monthly income minus required monthly income.
                        A negative result is the shortfall; a positive result is
                        money above your target.
                      </CalculationHelp>
                    </dt>
                    <dd>{money(Math.abs(result.difference))}</dd>
                  </div>
                </dl>
                <p
                  className={`scenario-target-status ${result.difference < 0 ? "scenario-negative" : ""}`}
                >
                  {result.difference >= 0
                    ? "Meets your target"
                    : result.projected.available >= 0
                      ? "Covers allocations, below your target"
                      : "Income does not cover allocations"}
                </p>
                <p className="scenario-help">
                  Monthly position: {signed(result.improvement)} compared with
                  your snapshot.
                </p>
              </>
            ) : (
              <p className="scenario-help">
                Complete your amounts to calculate the target.
              </p>
            )}
            <div className="scenario-solve-heading">
              <label htmlFor="scenario-solve">
                Income needed to meet your target
              </label>
              <CalculationHelp label="this income source’s required amount">
                Required monthly income minus income from your other active
                sources, with a minimum of zero. Changing this source does not
                change your other income amounts.
              </CalculationHelp>
            </div>
            <p className="scenario-help" id="scenario-solve-help">
              Choose an income source to cover a shortfall. We’ll calculate the
              increase needed, keeping your other income unchanged.
            </p>
            <ScenarioSelect
              aria-describedby="scenario-solve-help"
              id="scenario-solve"
              value={draft.selectedIncomeRowId ?? ""}
              onChange={(event) =>
                edit({
                  ...draft,
                  selectedIncomeRowId: event.target.value || undefined,
                })
              }
            >
              <option value="">Choose an income source</option>
              {draft.income
                .filter((row) => row.projected)
                .map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.projected!.name || "New income source"}
                  </option>
                ))}
            </ScenarioSelect>
            {result?.selectedRequired !== null &&
            result?.selectedRequired !== undefined ? (
              <div className="scenario-source-result">
                {result.difference >= 0 ? (
                  <p className="scenario-help">
                    {result.difference > 0 ? (
                      <>
                        Your income is {money(result.difference)} above your
                        monthly target.
                      </>
                    ) : (
                      <>Your income meets your monthly target.</>
                    )}{" "}
                    No increase is needed. Keep your current income amounts; any
                    extra gives you more money left each month.
                  </p>
                ) : (
                  <>
                    <p>
                      {draft.income.find(
                        (row) => row.key === draft.selectedIncomeRowId,
                      )?.projected?.name || "This income source"}{" "}
                      needs to bring in{" "}
                      <strong>{money(result.selectedRequired)}</strong> per
                      month after tax and business costs to cover your planned
                      spending, savings and leftover-money target.
                    </p>

                    <p className="scenario-help">
                      {result.otherSurplus > 0 ? (
                        <>
                          Other sources already cover the{" "}
                          {money(result.required)} total requirement, so this
                          source needs {money(0)}.
                        </>
                      ) : (
                        <>
                          {money(result.required)} required in total −{" "}
                          {money(
                            result.projected.income -
                              (selectedSource
                                ? parseAmount(
                                    selectedSource.amount,
                                    draft.currency,
                                  )!
                                : 0),
                          )}{" "}
                          from other sources = {money(result.selectedRequired)}{" "}
                          needed from {selectedSource?.name || "this source"}.
                        </>
                      )}
                    </p>
                    <p className="scenario-help" id="scenario-apply-help">
                      {selectedSource &&
                      parseAmount(selectedSource.amount, draft.currency) ===
                        result.selectedRequired ? (
                        <>
                          {selectedSource.name}’s What-if monthly amount is
                          already set to {money(result.selectedRequired)}. No
                          change is needed.
                        </>
                      ) : (
                        <>
                          This replaces {selectedSource?.name || "this source"}
                          ’s What-if monthly amount in Income sources, from{" "}
                          {selectedSource
                            ? money(
                                parseAmount(
                                  selectedSource.amount,
                                  draft.currency,
                                )!,
                              )
                            : "—"}{" "}
                          to {money(result.selectedRequired)}.
                        </>
                      )}
                    </p>
                    <button
                      className="btn-secondary"
                      aria-describedby="scenario-apply-help"
                      disabled={
                        !!selectedSource &&
                        parseAmount(selectedSource.amount, draft.currency) ===
                          result.selectedRequired
                      }
                      onClick={() => {
                        if (result.difference >= 0) return;
                        edit({
                          ...draft,
                          income: draft.income.map((row) =>
                            row.key === draft.selectedIncomeRowId &&
                            row.projected
                              ? {
                                  ...row,
                                  projected: {
                                    ...row.projected,
                                    amount: String(result.selectedRequired),
                                  },
                                }
                              : row,
                          ),
                        });
                        toast.success(
                          `${selectedSource?.name || "Income source"} updated to ${money(result.selectedRequired!)} per month`,
                          {
                            description:
                              "The What-if amount in Income sources has changed. Your actual budget is unchanged.",
                          },
                        );
                      }}
                    >
                      Set{" "}
                      {draft.income.find(
                        (row) => row.key === draft.selectedIncomeRowId,
                      )?.projected?.name || "this income source"}{" "}
                      to {money(result.selectedRequired)}
                    </button>
                    <p className="scenario-help">Updates this scenario only.</p>
                    {result.otherSurplus > 0 ? (
                      <p className="scenario-help">
                        Other sources already cover your target, with{" "}
                        {money(result.otherSurplus)} left above it.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </aside>
        </div>
        <section className="surface scenario-upfront">
          <header>
            <div>
              <h2>Upfront costs</h2>
              <p className="scenario-help">
                Moving, deposits or setup costs. Separate from your monthly
                plan.
              </p>
            </div>
            <button
              className="scenario-add"
              disabled={draft.oneOff.length >= MAX_ONE_OFF}
              onClick={() =>
                edit({
                  ...draft,
                  oneOff: [
                    ...draft.oneOff,
                    { key: crypto.randomUUID(), name: "", amount: "" },
                  ],
                })
              }
            >
              <Icon name="plus" />
              Add cost
            </button>
          </header>
          {draft.oneOff.map((row) => (
            <div className="scenario-upfront-row" key={row.key}>
              <input
                aria-label="Upfront cost name"
                value={row.name}
                maxLength={80}
                placeholder="Cost name"
                onChange={(event) =>
                  edit({
                    ...draft,
                    oneOff: draft.oneOff.map((item) =>
                      item.key === row.key
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <label className="scenario-amount">
                <span aria-hidden="true">
                  {getCurrencySymbol(draft.currency)}
                </span>
                <input
                  inputMode={draft.currency === "JPY" ? "numeric" : "decimal"}
                  aria-label={`${row.name || "Upfront cost"} amount`}
                  value={row.amount}
                  aria-invalid={
                    parseAmount(row.amount, draft.currency) === null
                  }
                  onChange={(event) =>
                    edit({
                      ...draft,
                      oneOff: draft.oneOff.map((item) =>
                        item.key === row.key
                          ? { ...item, amount: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <button
                className="icon-button icon-button-danger"
                aria-label={`Remove upfront cost ${row.name}`}
                onClick={() =>
                  edit({
                    ...draft,
                    oneOff: draft.oneOff.filter((item) => item.key !== row.key),
                  })
                }
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <p className="scenario-upfront-total">
            Upfront cash required{" "}
            <strong>{result ? money(result.upfront) : "—"}</strong>
          </p>
        </section>
      </fieldset>
      <ConfirmDialog
        open={deleting}
        title="Delete this scenario?"
        description="This removes the scenario and its comparison. Your actual budget stays as it is."
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await auto.suspend();
          try {
            await remove({ id });
            onSelect(null);
          } catch (error) {
            auto.resume();
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={discarding}
        title="Discard these local edits?"
        description="The scenario has been deleted. Leaving will discard the local version shown here."
        confirmLabel="Discard edits"
        onCancel={() => setDiscarding(false)}
        onConfirm={async () => {
          await auto.suspend();
          onSelect(null);
        }}
      />
      <ConfirmDialog
        open={reloading}
        title="Reload the saved version?"
        description="Your unsaved edits will be discarded and replaced by the version saved in the other tab."
        confirmLabel="Reload"
        onCancel={() => setReloading(false)}
        onConfirm={reload}
      />
    </section>
  );
}
