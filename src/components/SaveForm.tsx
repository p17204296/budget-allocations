import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { useFloatingSave } from "./FloatingSave";

function snapshot(form: HTMLFormElement) {
  const values: string[] = [];
  let valid = true;
  for (const field of form.querySelectorAll("input, select, textarea")) {
    if (field instanceof HTMLInputElement) {
      if (["submit", "button", "reset", "hidden"].includes(field.type))
        continue;
      values.push(
        field.type === "checkbox" || field.type === "radio"
          ? String(field.checked)
          : field.value,
      );
      if (field.willValidate && !field.validity.valid) valid = false;
    } else if (
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      values.push(field.value);
      if (field.willValidate && !field.validity.valid) valid = false;
    }
  }
  return { fingerprint: JSON.stringify(values), valid };
}
type Props = ComponentPropsWithoutRef<"form"> & {
  saveTitle: string;
  saveLabel: string;
  saving: boolean;
};
export function SaveForm({
  saveTitle,
  saveLabel,
  saving,
  onChange,
  ...props
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const initial = useRef<string | null>(null);
  const wasSaving = useRef(false);
  const [state, setState] = useState({
    dirty: false,
    valid: true,
    failed: false,
  });
  // Read after each commit as fields may be conditionally added or reset by the parent.
  useEffect(() => {
    const target = form.current;
    if (!target) return;
    const current = snapshot(target);
    if (initial.current === null) initial.current = current.fingerprint;
    const dirty = current.fingerprint !== initial.current;
    const failed = dirty && !saving && wasSaving.current;
    wasSaving.current = saving;
    setState((previous) => {
      const nextFailed = !dirty || saving ? false : failed || previous.failed;
      return previous.dirty === dirty &&
        previous.valid === current.valid &&
        previous.failed === nextFailed
        ? previous
        : { dirty, valid: current.valid, failed: nextFailed };
    });
  });
  const activate = useFloatingSave({
    visible: state.dirty || saving,
    title: saveTitle,
    status: saving
      ? "saving"
      : state.failed
        ? "error"
        : state.valid
          ? "dirty"
          : "invalid",
    actionLabel: state.failed ? "Retry save" : saveLabel,
    disabled: saving,
    onSave: () => form.current?.requestSubmit(),
  });
  return (
    <form
      {...props}
      ref={form}
      onChange={(event) => {
        onChange?.(event);
        const current = snapshot(event.currentTarget);
        setState({
          dirty: current.fingerprint !== initial.current,
          valid: current.valid,
          failed: false,
        });
        activate();
      }}
    />
  );
}
