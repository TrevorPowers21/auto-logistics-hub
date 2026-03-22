# Welcome to your Lovable project

TODO: Document your project here

## Project Notes

- Future requirement: add two-way API integrations for roughly 5-10 external websites and apps currently used by the business.
- Integration goal: pull operational data into this system and push updates back out so the app can become the primary daily workflow instead of duplicate entry.
- Future platform goal: use API integrations to consolidate all operating information into Monroe Auto's own app as the central system of record.
- Central workflow scope: picked up loads, cars being moved, delivered cars, driver load tracking, payroll, revenue, and expenses should all live in one place.
- Payroll requirement: drivers are paid per car, so the app needs stronger per-car and per-driver tracking for accurate payout reporting.
- Delivery operations requirement: add a dedicated hub for delivered cars organized by delivery date, not pickup date.

## Samsara Fleet Sync

- Local Fleet now includes a Samsara sync card tied to the official vehicle stats feed documentation: https://developers.samsara.com/docs/vehicle-stats-feed
- Save the Samsara token from the app Settings page. It is stored locally in `.samsara.local` and used by the backend sync job.
- The current setup pulls `gps`, `obdOdometerMeters`, `gpsOdometerMeters`, and `engineStates`.
- Feed sync is cursor-based. After each successful sync, the app stores the returned cursor and only requests newer updates on the next run.
- Standalone backend sync command: `npm run sync:samsara`
- Standalone sync writes the latest raw Samsara response state to `server/data/samsara-sync.json`, so nightly jobs no longer depend on the frontend being open.
- Local vehicles sync best when each unit has either:
  - a matching VIN to Samsara `externalIds.vin` or `externalIds.samsara.vin`, or
  - a saved `Samsara Vehicle ID` on the Fleet detail dialog.
