import { runSamsaraSync } from "./samsara-service.js";

try {
  const state = await runSamsaraSync();

  console.log(`Samsara sync completed at ${state.syncedAt}`);
  console.log(`Vehicles: ${state.counts.vehicles}`);
  console.log(`Vehicle feed items: ${state.counts.vehicleFeedItems}`);
  console.log(`Drivers: ${state.counts.driverFeedItems}`);
  console.log(`Cursor: ${state.cursor || "none"}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown Samsara sync error");
  process.exitCode = 1;
}
