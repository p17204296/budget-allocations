import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "delete expired guest users",
  { hourUTC: 3, minuteUTC: 17 },
  internal.cleanup.deleteExpiredGuests,
);

export default crons;
