export type SaveStatus =
  | "saved"
  | "dirty"
  | "saving"
  | "invalid"
  | "error"
  | "conflict";
export class ScenarioAutosave<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flight: Promise<boolean> | undefined;
  private version = 0;
  private savedVersion = 0;
  private deadline = 0;
  private active = true;
  private savingStopped = false;
  private savedFingerprint: string;
  status: SaveStatus = "saved";
  error = "";
  constructor(
    public draft: T,
    public revision: number,
    private validate: (draft: T) => boolean,
    private save: (draft: T, revision: number) => Promise<number>,
    private notify: () => void,
    private fingerprint: (draft: T) => string = JSON.stringify,
    private onSaved: () => void = () => {},
  ) {
    this.savedFingerprint = this.fingerprint(draft);
  }
  get pending() {
    return this.version !== this.savedVersion || !!this.flight;
  }
  edit(draft: T) {
    if (!this.active) return;
    this.draft = draft;
    this.version++;
    this.deadline = Date.now() + 6000;
    this.clearTimer();
    if (this.status !== "conflict") {
      this.error = "";
      this.status = this.validate(draft)
        ? this.flight
          ? "saving"
          : "dirty"
        : "invalid";
      this.schedule();
    }
    this.notify();
  }
  receive(draft: T, revision: number) {
    if (!this.pending && revision > this.revision) {
      this.draft = draft;
      this.revision = revision;
      this.savedFingerprint = this.fingerprint(draft);
      this.notify();
    }
  }
  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private schedule() {
    if (
      !this.active ||
      this.savingStopped ||
      !this.pending ||
      this.status === "conflict" ||
      this.status === "error" ||
      !this.validate(this.draft)
    )
      return;
    this.clearTimer();
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (!this.flight) void this.persist();
      },
      Math.max(0, this.deadline - Date.now()),
    );
  }
  private persist(): Promise<boolean> {
    if (!this.active || this.savingStopped || this.status === "conflict")
      return Promise.resolve(false);
    if (this.flight) return this.flight;
    if (!this.validate(this.draft)) {
      this.status = "invalid";
      this.notify();
      return Promise.resolve(false);
    }
    if (this.version === this.savedVersion) return Promise.resolve(true);
    if (this.fingerprint(this.draft) === this.savedFingerprint) {
      this.savedVersion = this.version;
      this.status = "saved";
      this.error = "";
      this.notify();
      return Promise.resolve(true);
    }
    this.clearTimer();
    const sentVersion = this.version;
    const sentDraft = this.draft;
    const revision = this.revision;
    this.status = "saving";
    this.error = "";
    this.notify();
    this.flight = (async () => {
      try {
        const nextRevision = await Promise.resolve().then(() =>
          this.save(sentDraft, revision),
        );
        if (!this.active || this.savingStopped) return false;
        this.revision = nextRevision;
        this.savedVersion = sentVersion;
        this.savedFingerprint = this.fingerprint(sentDraft);
        this.status =
          this.version === sentVersion
            ? "saved"
            : this.validate(this.draft)
              ? "dirty"
              : "invalid";
        if (this.status === "saved") this.onSaved();
        return true;
      } catch (error) {
        if (!this.active) return false;
        const data =
          error && typeof error === "object" && "data" in error
            ? error.data
            : undefined;
        const conflict =
          typeof data === "object" &&
          data !== null &&
          "code" in data &&
          data.code === "SCENARIO_CONFLICT";
        this.status = conflict ? "conflict" : "error";
        this.error = conflict
          ? "This scenario changed in another tab. Reload it or save your edits separately."
          : "Changes could not be saved. Your edits are still here. Retry when your connection is available.";
        return false;
      } finally {
        this.flight = undefined;
        if (this.active) {
          this.notify();
          this.schedule();
        }
      }
    })();
    return this.flight;
  }
  stopSaving() {
    this.savingStopped = true;
    this.clearTimer();
  }
  async flush() {
    if (this.savingStopped) return false;
    const target = this.version;
    this.clearTimer();
    if (this.flight && !(await this.flight)) return false;
    if (target !== this.version) return false;
    if (this.status === "conflict" || !this.validate(this.draft)) {
      this.status = this.status === "conflict" ? "conflict" : "invalid";
      this.notify();
      return false;
    }
    const success = await this.persist();
    return success && target === this.version && !this.pending;
  }
  retry() {
    return this.persist();
  }
  async suspend() {
    this.clearTimer();
    if (this.flight) await this.flight;
    this.active = false;
    this.clearTimer();
  }
  resume() {
    this.active = true;
    this.schedule();
  }
  dispose() {
    this.active = false;
    this.clearTimer();
  }
}
