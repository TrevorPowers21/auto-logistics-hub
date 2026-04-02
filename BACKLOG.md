# Auto Logistics Hub — Backlog Status

**Date:** 2026-04-01

---

## Already Done

### 4. Customer Name Display
**Status: Complete.** Customer codes are resolved to full names via `LocationProfile` lookup across all three dashboards — Loads (`customerDisplay()`), Planning Board (`customerOptions.find()`), and Driver Recap (`locationOptions.find()`). No placeholder text remaining.

### 5. Delivery Date & Tracking Details
**Status: Complete.** `deliveryDate` field exists on Load records. Auto-fills today's date when status changes to "delivered", clears when reverted. Displayed in load table with MM-dd format. Sortable by both pickup and delivered date (click column headers).

### 7. Bulk Finalize — Planning Board
**Status: Complete.** "Finalize Day's Loads" dialog shows all assigned slots for the day. "Finalize All" button creates formal Load records for every unconfirmed slot in one action. Shows count of remaining unconfirmed loads. Toast confirms how many were finalized.

### 8. Dashboard Overview Boxes
**Status: Complete.** Four live stat boxes on Index page: Active Loads, Active Drivers, Monthly Expenses, Outstanding Invoices. All pull from store getters — no hardcoded values. Also includes GPS fleet map, revenue vs expenses chart, and recent loads table.

### 9. Analytics & Charts
**Status: Complete.** DriverAnalyticsTab has: daily/weekly trend chart (stacked bar), cars by driver chart, pay by driver chart, customer leaderboard table, driver breakdown table with completion %. Split loads tracked via `stop.status === "split"`. Uses Recharts.

### 11. Asset Organization — Drivers, Trucks, Customers
**Status: Complete.** All four asset pages (Drivers, Vehicles, Locations/Customers, Addresses) have full CRUD, search/filter, and alphabetical navigation where applicable. No template or placeholder records. Drivers can be marked inactive (collapsed section). Vehicles have VIN decoder and maintenance logs.

---

## Needs Work — Next Steps

### 1. Bug Fix — Load Finalization (Priority 1)
**What works:** Finalizing from Planning Board creates a Load and links it via `loadId`. Creating a load on Loads dashboard calls `syncLoadsToPlanning()` which creates/patches planning slots.

**What's broken:** When a load is created on the Loads dashboard and assigned a driver, it syncs to the planning board but does NOT auto-populate the driver recap until the recap page reloads and picks up the planning slot. The recap relies on matching `planningSlots.filter(s => s.driverId === driver.id && s.date === forDate)` — if the slot was just created, the reactive hook may not have fired yet.

**Next steps:**
- [ ] Verify that `saveLoads()` triggers a `store-update` event that the recap page picks up
- [ ] Check if `syncLoadsToPlanning()` is saving slots with the correct `driverId` from the Load
- [ ] Add a `customer` field to the planning slot during sync (currently may be missing)
- [ ] Test the full flow: create load on Loads dashboard -> appears on Planning Board -> appears on Driver Recap (same session, no refresh)

---

### 2. Auto-Sync / Live Updates
**What works:** Within a single browser tab, `store-update` CustomEvent fires on every save and components re-render via `useStoreData()` hook. Supabase background sync writes changes to the cloud.

**What's missing:** No cross-tab or cross-device sync. If Susan has the recap open and the dispatcher creates a load in another tab/device, Susan won't see it until she refreshes.

**Next steps:**
- [ ] Add a Supabase realtime subscription on key tables (`loads`, `planning_slots`, `driver_board_entries`) that triggers `hydrateKey()` on change
- [ ] OR: Add a simple polling interval (every 30-60s) that calls `hydrateAll()` and dispatches `store-update`
- [ ] Recommendation: Start with polling (simpler, no Supabase plan upgrade needed). Add a "Last synced: X seconds ago" indicator to the header so users know data is fresh.

---

### 3. Driver Assignment & Status Tracking
**What works:** `Vehicle.assignedDriverId` field exists. Fleet page displays assigned driver name. Driver has `status` field (active/inactive/on_leave). `DriverDailyStatus` type is defined (available/en_route/delivered/delay/off_duty).

**What's missing:** No UI to assign a driver to a vehicle from the Fleet page. `DriverDailyStatus` is never used — no operational status tracking. The OFF feature on the planning board is the closest thing to real-time status.

**Next steps:**
- [ ] Add a driver dropdown to the Vehicle edit dialog so drivers can be assigned to trucks
- [ ] Derive operational driver status from current data: if driver has loads today with status "in_transit" -> "en_route"; if planning board shows OFF -> "off_duty"; if no work -> "available"
- [ ] Show derived status badge on Driver cards in the recap and on the main dashboard
- [ ] Optional: Add a dedicated "Driver Status Board" view showing all drivers + their current state at a glance

---

### 6. Pay Rate Formatting & Driver Notes
**What works:** `payRatePerCar` exists on Driver and on individual stops (override). Displayed as `$X/car` in Drivers table and recap. Editable in driver add/edit dialog. Recap validates missing pay rates on submit.

**What's missing:** No persistent `notes` field on the Driver type. Driver notes only exist as temporary off-notes from planning board.

**Next steps:**
- [ ] Add `notes?: string` field to the `Driver` interface in `types.ts`
- [ ] Add a Textarea to the driver add/edit dialog in `Drivers.tsx`
- [ ] Run `ALTER TABLE drivers ADD COLUMN notes TEXT DEFAULT '';` in Supabase SQL Editor
- [ ] Display notes on driver detail view (collapsed by default, expandable)

---

### 10. Local Loads — Address Cleanup
**What works:** Address model exists with full fields (name, line1, city, state, zip). Loads store pickup/delivery as text strings matching address names. Dropdown search works for address selection on Loads, Planning Board, and Driver Recap.

**What's missing:** Address records imported from VehicleHaul CSV only have `name` populated — `line1`, `city`, `state`, `zip` are empty strings. Load detail views show location name only, not the full address.

**Next steps:**
- [ ] Audit imported addresses: count how many have empty `line1`/`city`/`state` fields
- [ ] If VehicleHaul CSV has full address data, re-import with all fields populated
- [ ] On load detail view, show full address (city, state) below the location name when available
- [ ] Add validation: when creating a new address inline, prompt for at least city + state

---

### 12. Mileage Sync
**What works:** Samsara sync pulls OBD/GPS odometer readings, converts meters to miles, stores on Vehicle record. Displayed in Fleet table. Editable manually. `lastSyncedAt` timestamp tracked.

**What's missing:** No mileage history/trend tracking. Mileage only updates on manual Samsara sync (no automatic polling). No notification when mileage changes.

**Next steps:**
- [ ] Tie mileage sync into the auto-polling from item #2 (when polling is added, include Samsara refresh)
- [ ] Optional: Store mileage snapshots over time for trend tracking (new `mileage_history` table)
- [ ] Show "last synced X ago" on Fleet page near the Sync button
- [ ] Consider: auto-sync Samsara on Fleet page load (debounced, max once per 5 min)
