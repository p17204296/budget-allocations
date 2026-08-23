import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { TabId } from "./BudgetPlanner";
import { Icon } from "./ui";

type FeedbackType = "idea" | "problem" | "other";

const feedbackTypes: { value: FeedbackType; label: string; description: string }[] = [
  { value: "idea", label: "Idea", description: "A way to improve the app" },
  { value: "problem", label: "Problem", description: "Something isn't working" },
  { value: "other", label: "Other", description: "Anything else to share" },
];

export function FeedbackDialog({ open, page, onClose }: { open: boolean; page: TabId; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitFeedback = useMutation(api.feedback.submit);
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (isSubmitting) return;
    setType("idea");
    setMessage("");
    setError("");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 5) {
      setError("Please add a little more detail so we can understand your feedback.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await submitFeedback({ type, message, page });
      toast.success("Thanks — your feedback has been sent.");
      setType("idea");
      setMessage("");
      onClose();
    } catch {
      setError("Your feedback could not be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="feedback-dialog" aria-labelledby="feedback-title" aria-describedby="feedback-description" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="feedback-dialog-panel">
        <header className="feedback-dialog-header">
          <span className="feedback-dialog-icon"><Icon name="feedback" /></span>
          <button type="button" className="dialog-close" onClick={close} aria-label="Close feedback form" disabled={isSubmitting}><Icon name="close" /></button>
          <p className="eyebrow">Help shape the app</p>
          <h2 id="feedback-title">Share your feedback</h2>
          <p id="feedback-description">Tell us what would make budgeting feel clearer or easier.</p>
        </header>
        <form className="feedback-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>What would you like to share?</legend>
            <div className="feedback-types">
              {feedbackTypes.map((option) => (
                <label key={option.value} className={type === option.value ? "active" : ""}>
                  <input id={`feedback-type-${option.value}`} className="sr-only" type="radio" name="feedback-type" value={option.value} checked={type === option.value} onChange={() => setType(option.value)} />
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="feedback-message" className="feedback-message-label">Your feedback</label>
          <textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1500} rows={5} placeholder="What happened, or what would you like to see?" aria-describedby={`feedback-help${error ? " feedback-error" : ""}`} />
          <div className="feedback-help" id="feedback-help"><span>Please don’t include sensitive financial information.</span><span aria-label={`${message.length} of 1500 characters`}>{message.length}/1500</span></div>
          {error ? <p className="feedback-error" id="feedback-error" role="alert">{error}</p> : null}
          <div className="feedback-actions"><button type="button" className="btn-secondary" onClick={close} disabled={isSubmitting}>Cancel</button><button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send feedback"}</button></div>
        </form>
      </div>
    </dialog>
  );
}
