import type { EventDraft } from "../../shared/events";

/** Financial values reproduced from the read-only live example; no account data. */
export function octoberJanuaryEvent(): EventDraft {
  return {
    name: "October to January savings",
    currency: "GBP",
    budget: 2940,
    eventDate: "2026-12-18",
    fundingDate: "2027-01-18",
    fundingDateIndependent: true,
    fundingMode: "total",
    fundingAmount: 0,
    trackPaymentsAgainstSavings: false,
    items: [{ key: "costs", name: "Event costs", cost: 2870, paid: 618 }],
    savingsPlan: {
      startDate: "2026-10-15",
      startingFunding: 0,
      months: [
        { month: "2026-10", planned: 735, actual: 0 },
        { month: "2026-11", planned: 980, actual: 0 },
        { month: "2026-12", planned: 980, actual: 0 },
        { month: "2027-01", planned: 980, actual: 0 },
      ],
    },
  };
}
