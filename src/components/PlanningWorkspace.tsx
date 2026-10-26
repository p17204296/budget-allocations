import { useState } from "react";
import { useNavigationGuard } from "../hooks/NavigationGuard";
import { WhatIfWorkspace } from "./WhatIfWorkspace";
import { EventsWorkspace } from "./EventsWorkspace";
export function PlanningWorkspace() {
  const [section, setSection] = useState<"monthly" | "events">("monthly");
  const { navigate, busy } = useNavigationGuard();
  return (
    <div className="planning-workspace">
      <nav className="planning-sections" aria-label="Planning sections">
        <button
          type="button"
          disabled={busy}
          aria-current={section === "monthly" ? "page" : undefined}
          onClick={() => {
            if (section !== "monthly")
              void navigate(() => setSection("monthly"));
          }}
        >
          Monthly what-if
        </button>
        <button
          type="button"
          disabled={busy}
          aria-current={section === "events" ? "page" : undefined}
          onClick={() => {
            if (section !== "events") void navigate(() => setSection("events"));
          }}
        >
          Events
        </button>
      </nav>
      {section === "monthly" ? <WhatIfWorkspace /> : <EventsWorkspace />}
    </div>
  );
}
