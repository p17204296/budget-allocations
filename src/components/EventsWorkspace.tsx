import { useFloatingSave } from "./FloatingSave";
import { SaveForm } from "./SaveForm";
import { useEffect, useId, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import {
  calculateEvent,
  convertFunding,
  dateString,
  MAX_EVENT_ITEMS,
  MAX_EVENTS,
  type FundingMode,
} from "../../shared/events";
import { editEvent, parseEvent, type EditableEvent } from "../lib/eventDraft";
import { ScenarioAutosave } from "../lib/scenarioAutosave";
import { parseAmount } from "../lib/scenarioDraft";
import { getCurrencySymbol } from "../lib/currency";
import { useNavigationGuard } from "../hooks/NavigationGuard";
import { ConfirmDialog, Icon, PageHeader } from "./ui";
import { ScenarioSelect } from "./ScenarioSelect";
import { CalculationHelp } from "./CalculationHelp";
import { toast } from "sonner";

type Detail = NonNullable<FunctionReturnType<typeof api.events.get>>;
function message(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "string"
  )
    return error.data;
  return "This action could not be completed. Your edits are still here. Please try again.";
}
function money(amount: number, currency: string): string {
  return `${getCurrencySymbol(currency)}${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amount)}`;
}
export function EventsWorkspace() {
  const events = useQuery(api.events.list);
  const create = useMutation(api.events.create);
  const { navigate } = useNavigationGuard();
  const [selected, setSelected] = useState<Id<"events"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = () => {
    setCreating(true);
    setName("");
    setError("");
  };
  return (
    <div className="events-workspace whatif-workspace">
      <PageHeader
        title="Events"
        description="Make room for the moments coming up. Plan each cost and see what you still need."
      />
      {selected ? (
        <EventLoader
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      ) : (
        <>
          <div className="events-list-heading">
            <h2>Your event plans</h2>
            <button
              type="button"
              className="btn-primary"
              disabled={
                events === undefined || events.length >= MAX_EVENTS || busy
              }
              onClick={start}
            >
              <Icon name="plus" />
              New event
            </button>
          </div>
          {events && events.length >= MAX_EVENTS ? (
            <p className="event-help">
              You have 20 events. Delete one before creating another.
            </p>
          ) : null}
          {creating ? (
            <SaveForm saveTitle="New event" saveLabel="Create event" saving={busy}
              className="surface event-create"
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                void create({ name })
                  .then((id) => {
                    setSelected(id);
                    setCreating(false);
                  })
                  .catch((error) => setError(message(error)))
                  .finally(() => setBusy(false));
              }}
            >
              <h2>Plan an event</h2>
              <label htmlFor="event-create-name">Event name</label>
              <input
                id="event-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="For example, our anniversary"
                maxLength={80}
                required
                autoFocus
                disabled={busy}
              />
              <div className="event-actions">
                <button className="btn-primary" disabled={busy || !name.trim()}>
                  {busy ? "Creating…" : "Create event"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </button>
              </div>
              {error ? (
                <p role="alert" className="scenario-error">
                  {error}
                </p>
              ) : null}
            </SaveForm>
          ) : null}
          {events === undefined ? (
            <p role="status">Loading events…</p>
          ) : events.length === 0 ? (
            <div className="surface scenario-empty">
              <Icon name="target" />
              <h2>Something to look forward to</h2>
              <p>
                Birthdays, anniversaries, a weekend away. Give each occasion its
                own budget, then add hotels, gifts, flights, and everything in
                between.
              </p>
              <button type="button" className="btn-primary" onClick={start}>
                Plan your first event
              </button>
            </div>
          ) : (
            <div className="event-list">
              {[...events]
                .sort((a, b) =>
                  (a.event.eventDate || "9999").localeCompare(
                    b.event.eventDate || "9999",
                  ),
                )
                .map(({ event, total }) => (
                  <button
                    type="button"
                    className="surface event-list-entry"
                    key={event._id}
                    onClick={() => void navigate(() => setSelected(event._id))}
                  >
                    <span className="event-list-title">{event.name}</span>
                    <span className="event-help">
                      {event.eventDate
                        ? `Event date: ${event.eventDate}`
                        : "Date not set"}
                    </span>
                    <span className="event-list-figures">
                      <span>
                        Budget{" "}
                        <strong>{money(event.budget, event.currency)}</strong>
                      </span>
                      <span>
                        Item costs{" "}
                        <strong>{money(total, event.currency)}</strong>
                      </span>
                    </span>
                    <span
                      className={
                        total > event.budget ? "event-overrun" : "event-within"
                      }
                    >
                      {total > event.budget
                        ? `${money(total - event.budget, event.currency)} over budget`
                        : `${money(event.budget - total, event.currency)} within budget`}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function EventLoader({
  id,
  onClose,
}: {
  id: Id<"events">;
  onClose: () => void;
}) {
  const detail = useQuery(api.events.get, { id });
  const [last, setLast] = useState<Detail | null>(null);
  useEffect(() => {
    if (detail) setLast(detail);
  }, [detail]);
  const current = detail ?? last;
  if (!current)
    return detail === undefined ? (
      <p role="status">Loading event…</p>
    ) : (
      <div className="surface event-create">
        <p>This event is no longer available.</p>
        <button className="btn-secondary" onClick={onClose}>
          Back to events
        </button>
      </div>
    );
  return (
    <EventEditor
      id={id}
      detail={current}
      deleted={detail === null}
      onClose={onClose}
    />
  );
}
function AmountField({
  label,
  value,
  onChange,
  currency,
  invalid = false,
  errorText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  invalid?: boolean;
  errorText?: string;
}) {
  const id = useId();
  const invalidAmount = parseAmount(value, currency) === null;
  return (
    <div className="event-field">
      <label htmlFor={id}>{label}</label>
      <div className="scenario-amount">
        <span aria-hidden="true">{getCurrencySymbol(currency)}</span>
        <input
          id={id}
          inputMode={currency === "JPY" ? "numeric" : "decimal"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || invalidAmount || Boolean(errorText)}
          aria-describedby={
            invalidAmount || errorText ? `${id}-error` : undefined
          }
        />
      </div>
      {invalidAmount ? (
        <span id={`${id}-error`} className="event-field-error">
          Enter a non-negative amount
          {currency === "JPY"
            ? " in whole yen"
            : " with up to two decimal places"}
          .
        </span>
      ) : errorText ? (
        <span id={`${id}-error`} className="event-field-error">
          {errorText}
        </span>
      ) : null}
    </div>
  );
}
function EventEditor({
  id,
  detail,
  deleted,
  onClose,
}: {
  id: Id<"events">;
  detail: Detail;
  deleted: boolean;
  onClose: () => void;
}) {
  const save = useMutation(api.events.save);
  const remove = useMutation(api.events.remove);
  const client = useConvex();
  const { register, navigate, busy: navigating } = useNavigationGuard();
  const [, redraw] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<
    "delete" | "reload" | "discard" | null
  >(null);
  const [today, setToday] = useState(() => dateString(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setToday(dateString(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);
  const makeController = (value: Detail) =>
    new ScenarioAutosave(
      editEvent(value.draft),
      value.event.revision,
      (draft) => parseEvent(draft).draft !== null,
      async (draft, revision) => {
        const parsed = parseEvent(draft);
        if (!parsed.draft) throw new Error(parsed.error);
        return save({ id, expectedRevision: revision, draft: parsed.draft });
      },
      () => redraw((value) => value + 1),
      JSON.stringify,
      () => toast.success("Event saved", { id: `event-save-${id}` }),
    );
  const [auto, setAuto] = useState(() => makeController(detail));
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
    else auto.receive(editEvent(detail.draft), detail.event.revision);
  }, [auto, detail, deleted]);
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
  const parsed = parseEvent(draft);
  const result = parsed.draft
    ? calculateEvent(parsed.draft, new Date(`${today}T12:00:00`))
    : null;
  const edit = (next: EditableEvent) => {
    setError("");
    auto.edit(next);
  };
  const updateItem = (
    key: string,
    field: "name" | "cost" | "paid",
    value: string,
  ) =>
    edit({
      ...draft,
      items: draft.items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    });
  const switchFunding = (value: string) => {
    const mode: FundingMode | null =
      value === "available" || value === "total" ? value : null;
    if (!mode || !parsed.draft) return;
    edit({
      ...draft,
      fundingMode: mode,
      fundingAmount: String(convertFunding(parsed.draft, mode)),
    });
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(message(error));
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const status = deleted
    ? "Event deleted in another tab"
    : {
        saved: "All changes saved",
        dirty: "Unsaved changes · autosaves after 6 seconds",
        saving: "Saving changes…",
        invalid: "Complete the highlighted fields to save",
        error: "Changes not saved",
        conflict: "Saved version changed in another tab",
      }[auto.status];
  const blocked = busy || navigating;
  const editor = useRef<HTMLDivElement>(null);
  useFloatingSave({
    visible: auto.pending || deleted,
    title: "Event plan",
    status: deleted ? "conflict" : auto.status === "saved" ? "dirty" : auto.status,
    actionLabel: deleted || auto.status === "conflict" ? "Review changes" : !parsed.draft ? "Check fields" : auto.status === "error" ? "Retry save" : "Save now",
    disabled: blocked,
    onSave: () => {
      if (deleted) setConfirm("discard");
      else if (auto.status === "conflict") setConfirm("reload");
      else if (!parsed.draft) {
        const invalid = editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalid?.focus(); invalid?.scrollIntoView({ block: "center" });
      } else void auto.flush();
    },
  });
  return (
    <div className="event-editor" ref={editor}>
      <header className="event-editor-toolbar">
        <button
          type="button"
          className="btn-secondary"
          disabled={blocked}
          onClick={() => void navigate(onClose)}
        >
          Back to events
        </button>
        <div className="event-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={
              blocked ||
              deleted ||
              auto.status === "conflict" ||
              !parsed.draft ||
              !auto.pending
            }
            onClick={() => void auto.flush()}
          >
            Save changes
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={blocked}
            onClick={() => setConfirm("delete")}
          >
            Delete event
          </button>
        </div>
      </header>
      <p className="scenario-save-status" role="status" aria-live="polite">
        {status}
      </p>
      {auto.status === "error" || auto.status === "conflict" || deleted ? (
        <div className="surface event-notice" role="alert">
          <p>
            {deleted
              ? "This event was deleted elsewhere. Your local draft is still visible; discard it to return to your events."
              : auto.error}
          </p>
          {auto.status === "error" && !deleted ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void auto.retry()}
            >
              Retry save
            </button>
          ) : null}
          {auto.status === "conflict" && !deleted ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirm("reload")}
            >
              Reload saved version
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="scenario-error">
          {error}
        </p>
      ) : null}
      <fieldset className="event-fields" disabled={blocked || deleted}>
        <legend className="sr-only">Event plan</legend>
        <section className="surface event-details">
          <h2>Event details</h2>
          <div className="event-field">
            <label htmlFor="event-name">Event name</label>
            <input
              id="event-name"
              value={draft.name}
              maxLength={80}
              aria-invalid={!draft.name.trim()}
              onChange={(event) => edit({ ...draft, name: event.target.value })}
            />
          </div>
          <AmountField
            label="Total budget"
            value={draft.budget}
            currency={draft.currency}
            onChange={(budget) => edit({ ...draft, budget })}
          />
          <div className="event-field">
            <label htmlFor="event-date">Event date (optional)</label>
            <input
              type="date"
              id="event-date"
              value={draft.eventDate}
              onChange={(event) =>
                edit({
                  ...draft,
                  eventDate: event.target.value,
                  fundingDate: draft.fundingDateIndependent
                    ? draft.fundingDate
                    : event.target.value,
                })
              }
            />
          </div>
          <p className="event-help">
            Amounts are in {draft.currency}. This plan is separate from your
            monthly budget.
          </p>
        </section>
        <section className="surface event-summary" aria-label="Event summary">
          <h2>Where your plan stands</h2>
          {result ? (
            <>
              <div
                className={`event-budget-result ${result.budgetDifference < 0 ? "event-overrun" : "event-within"}`}
              >
                <span>
                  {result.budgetDifference < 0
                    ? "Extra budget needed"
                    : "Budget remaining"}
                </span>
                <strong>
                  {money(Math.abs(result.budgetDifference), draft.currency)}
                </strong>
              </div>
              <dl className="event-summary-totals">
                <div>
                  <dt>Total budget</dt>
                  <dd>{money(result.budget, draft.currency)}</dd>
                </div>
                <div>
                  <dt>Total item costs</dt>
                  <dd>{money(result.total, draft.currency)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{money(result.paid, draft.currency)}</dd>
                </div>
                <div>
                  <dt>Still to pay</dt>
                  <dd>{money(result.unpaid, draft.currency)}</dd>
                </div>
              </dl>
              <div className="event-funding-result">
                <span>
                  Additional savings needed{" "}
                  <CalculationHelp label="additional savings needed">
                    Fund the higher of your budget or item costs.{" "}
                    {draft.fundingMode === "available"
                      ? "Subtract payments already made and money still available."
                      : "Subtract your total funded so far, which includes payments already made."}
                  </CalculationHelp>
                </span>
                <strong>{money(result.gap, draft.currency)}</strong>
                <p>
                  {result.gap === 0
                    ? "Your event’s funding target is covered."
                    : result.contributions === 0
                      ? "The funding deadline has passed. This amount is needed now."
                      : result.monthly !== null
                        ? `${money(result.monthly, draft.currency)} per month across ${result.contributions} contribution${result.contributions === 1 ? "" : "s"}, starting today.`
                        : "Set a funding deadline below to see a monthly saving suggestion."}
                </p>
              </div>
            </>
          ) : (
            <p className="event-field-error" role="status">
              {parsed.error} Totals will return when the plan is valid.
            </p>
          )}
        </section>
        <section className="event-items">
          <header className="events-list-heading">
            <h2>What you need to buy</h2>
            <button
              type="button"
              className="btn-secondary"
              disabled={draft.items.length >= MAX_EVENT_ITEMS}
              onClick={() =>
                edit({
                  ...draft,
                  items: [
                    ...draft.items,
                    { key: crypto.randomUUID(), name: "", cost: "", paid: "0" },
                  ],
                })
              }
            >
              <Icon name="plus" />
              Add item
            </button>
          </header>
          <p className="event-help">
            Use the full expected cost, including any deposit. Record payments
            separately.
          </p>
          {draft.items.length === 0 ? (
            <p className="surface event-items-empty">
              No items yet. Add a hotel, a gift, flights, or anything else you
              have in mind.
            </p>
          ) : (
            draft.items.map((item, index) => {
              const cost = parseAmount(item.cost, draft.currency);
              const paid = parseAmount(item.paid, draft.currency);
              const invalidPayment =
                cost !== null && paid !== null && paid > cost;
              return (
                <section
                  className="surface event-item"
                  key={item.key}
                  aria-label={`Item ${index + 1}`}
                >
                  <div className="event-field event-item-name">
                    <label htmlFor={`event-item-${item.key}`}>
                      Item description
                    </label>
                    <input
                      id={`event-item-${item.key}`}
                      value={item.name}
                      maxLength={120}
                      aria-invalid={!item.name.trim()}
                      placeholder="For example, hotel"
                      onChange={(event) =>
                        updateItem(item.key, "name", event.target.value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="event-remove"
                    aria-label={`Remove item ${index + 1}${item.name ? `: ${item.name}` : ""}`}
                    onClick={() =>
                      edit({
                        ...draft,
                        items: draft.items.filter(
                          (row) => row.key !== item.key,
                        ),
                      })
                    }
                  >
                    <Icon name="trash" />
                  </button>
                  <AmountField
                    label="Expected cost"
                    value={item.cost}
                    currency={draft.currency}
                    onChange={(value) => updateItem(item.key, "cost", value)}
                  />
                  <AmountField
                    label="Amount paid"
                    value={item.paid}
                    currency={draft.currency}
                    invalid={invalidPayment}
                    onChange={(value) => updateItem(item.key, "paid", value)}
                  />
                  <p
                    className={
                      invalidPayment
                        ? "event-field-error event-item-remaining"
                        : "event-item-remaining"
                    }
                  >
                    {invalidPayment ? (
                      "Amount paid cannot exceed expected cost."
                    ) : (
                      <>
                        Still to pay{" "}
                        <strong>
                          {cost !== null && paid !== null
                            ? money(
                                Math.round(
                                  (cost - paid) *
                                    (draft.currency === "JPY" ? 1 : 100),
                                ) / (draft.currency === "JPY" ? 1 : 100),
                                draft.currency,
                              )
                            : "Complete amounts above"}
                        </strong>
                      </>
                    )}
                  </p>
                </section>
              );
            })
          )}
          {draft.items.length >= MAX_EVENT_ITEMS ? (
            <p className="event-help">
              This event has reached its 200-item limit.
            </p>
          ) : null}
        </section>
        <section className="surface event-funding">
          <h2>How you’ll fund it</h2>
          <p className="event-help">
            Save towards your full budget, or the item total if it is higher.
          </p>
          <div className="event-field">
            <label htmlFor="event-funding-mode">
              How are you recording your funding?
            </label>
            <ScenarioSelect
              id="event-funding-mode"
              value={draft.fundingMode}
              disabled={!parsed.draft}
              onChange={(event) => switchFunding(event.target.value)}
              options={[
                { value: "available", label: "Money still available" },
                { value: "total", label: "Total funded so far" },
              ]}
            />
          </div>
          <p className="event-help">
            {draft.fundingMode === "available"
              ? "Money currently set aside for this event, excluding anything already spent. Update this balance yourself after purchases."
              : "All money committed to this event, including payments already made. This must cover your recorded payments."}{" "}
            Changing the funding method converts the amount for you.
          </p>
          <AmountField
            label={
              draft.fundingMode === "available"
                ? "Money still available"
                : "Total funded so far"
            }
            value={draft.fundingAmount}
            errorText={
              parsed.error?.includes("Total funded so far must cover")
                ? parsed.error
                : undefined
            }
            currency={draft.currency}
            onChange={(fundingAmount) => edit({ ...draft, fundingAmount })}
          />
          <div className="event-field">
            <label htmlFor="event-funding-date">
              Have money ready by (optional)
            </label>
            <input
              type="date"
              id="event-funding-date"
              value={draft.fundingDate}
              onChange={(event) =>
                edit({
                  ...draft,
                  fundingDate: event.target.value,
                  fundingDateIndependent: true,
                })
              }
            />
          </div>
          <p className="event-help">
            Allow time to pay for bookings before the event.{" "}
            {draft.fundingDateIndependent
              ? "You have set a separate funding deadline."
              : "This deadline follows your event date."}
          </p>
          {draft.fundingDateIndependent ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                edit({
                  ...draft,
                  fundingDate: draft.eventDate,
                  fundingDateIndependent: false,
                })
              }
            >
              Use event date
            </button>
          ) : null}
          <p className="event-help">
            Monthly suggestions count a contribution today, then one each month
            through your deadline. Month-end dates use the last available day.
            Payments and funding amounts are manual; your account balances stay
            as they are.
          </p>
        </section>
      </fieldset>
      {auto.pending || deleted ? (
        <button
          type="button"
          className="btn-secondary event-discard"
          disabled={blocked}
          onClick={() => setConfirm("discard")}
        >
          Discard edits and return
        </button>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "delete"
            ? "Delete this event?"
            : confirm === "reload"
              ? "Reload the saved event?"
              : "Discard your edits?"
        }
        description={
          confirm === "delete"
            ? "The event and all of its items will be deleted, including any unsaved edits."
            : "Your local edits will be discarded. This cannot be undone."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete event"
            : confirm === "reload"
              ? "Reload saved version"
              : "Discard edits"
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            if (confirm === "reload") {
              const latest = await client.query(api.events.get, { id });
              if (!latest) {
                setError(
                  "This event has been deleted. Discard your edits to return.",
                );
                setConfirm(null);
                return;
              }
              auto.dispose();
              setAuto(makeController(latest));
            } else if (confirm === "delete") {
              await auto.suspend();
              try {
                await remove({ id, expectedRevision: auto.revision });
                auto.dispose();
                onClose();
                toast.success("Event deleted");
              } catch (error) {
                auto.resume();
                throw error;
              }
            } else {
              await auto.suspend();
              auto.dispose();
              onClose();
            }
            setConfirm(null);
          })
        }
      />
    </div>
  );
}
