// Import drivers from VehicleHaul CSV into Supabase
// Run: node scripts/import-drivers.cjs

const fs = require("fs");

// Read .env for Supabase credentials
const envPath = require("path").resolve(__dirname, "../.env");
const envText = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^(\w+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

// Parse the driver license field: "895 566 376 NY   6/28/2029" -> { number, state, expiry }
function parseLicense(raw) {
  if (!raw || !raw.trim()) return { number: "", state: "", expiry: "" };
  const s = raw.trim();
  // Try to find state abbreviation (2 letters) and date
  const match = s.match(/^(.+?)\s+([A-Z]{2})\s+(.+)$/);
  if (match) {
    return { number: match[1].trim(), state: match[2], expiry: parseDate(match[3].trim()) };
  }
  // Some just have a number with no state/expiry
  return { number: s, state: "", expiry: "" };
}

function parseDate(raw) {
  if (!raw || !raw.trim()) return "";
  const s = raw.trim().replace(" 0:00", "").replace(" 12:00", "");
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0]; // yyyy-MM-dd
}

function cleanPhone(raw) {
  if (!raw) return "";
  // Strip everything but the first phone number (before any H: or second number)
  return raw.replace(/C:\s*/, "").split(/\s*H:/)[0].trim();
}

// CSV data from VehicleHaul export
const csvRows = [
  { id: "2", name: "John Anderson", identifier: "78", email: "janderson10172327@gmail.com", phone: "845-637-0668", mc: "234418", dot: "401170", license: "895 566 376 NY   6/28/2029", deactivated: "" },
  { id: "3", name: "Andrew Bradley", identifier: "", email: "abradley189@gmail.com", phone: "845-863-9936", mc: "234418", dot: "401170", license: "984 739 324 NY   1/13/2028", deactivated: "6/19/23 0:00" },
  { id: "4", name: "Daniel Cataldo", identifier: "65", email: "dancataldo71@gmail.com", phone: "845 629-5423", mc: "234418", dot: "401170", license: "655 579 531 NY   4/21/2028", deactivated: "" },
  { id: "5", name: "Keith Fitzell", identifier: "73", email: "keamtrans@gmail.com", phone: "845 913 8810", mc: "234418", dot: "401170", license: "320 671 730 NY  11/16/2025", deactivated: "6/12/25 0:00" },
  { id: "6", name: "Steve Meyer", identifier: "79", email: "stephenmeyer6716@gmail.com", phone: "845-656-0233", mc: "234418", dot: "401170", license: "589 319 049 NY  2/5/2026", deactivated: "" },
  { id: "7", name: "Andrew Ogonowski", identifier: "", email: "andrew_o@monroetrans.com", phone: "845-656-0229", mc: "234418", dot: "401170", license: "358 371 804 NY  11/28/2028", deactivated: "" },
  { id: "8", name: "Chris Ogonowski", identifier: "", email: "chris_o@monroetrans.com", phone: "845-656-0230", mc: "234418", dot: "401170", license: "234 019 276 NY  04/17/2027", deactivated: "" },
  { id: "9", name: "Marcin Roman", identifier: "67", email: "marcinroman76@gmail.com", phone: "201-456-3980", mc: "234418", dot: "401170", license: "R6323 51762 02762 NJ   2/7/2026", deactivated: "" },
  { id: "10", name: "Mitch Rudzinski", identifier: "74", email: "mitchrudzinski@gmail.com", phone: "845-235-0518", mc: "234418", dot: "401170", license: "611 304 132 NY  2/16/2026", deactivated: "" },
  { id: "11", name: "Matthew Salamin", identifier: "75", email: "woodywfd39@gmail.com", phone: "845-637-4255", mc: "234418", dot: "401170", license: "700 365 240 NY  10/22/2020", deactivated: "2/26/26 0:00" },
  { id: "12", name: "Chris Traynor", identifier: "54", email: "ctraynorhd125@gmail.com", phone: "845-541-8933", mc: "234418", dot: "401170", license: "300 207 492 NY  8/24/2022", deactivated: "2/26/26 0:00" },
  { id: "13", name: "Mark Trevorah", identifier: "61", email: "mark.trevorah@gmail.com", phone: "845-656-0234", mc: "234418", dot: "401170", license: "949 363 496 NY     1/25/2027", deactivated: "" },
  { id: "14", name: "John White", identifier: "72", email: "jhw21800@gmail.com", phone: "845-656-0236", mc: "234418", dot: "401170", license: "427 878 063 NY   12/27/2027", deactivated: "" },
  { id: "15", name: "Joseph Ogonowski", identifier: "Joseph", email: "josephogonowski@gmail.com", phone: "8456560240", mc: "234418", dot: "401170", license: "", deactivated: "" },
  { id: "17", name: "Justin Ogonowski", identifier: "", email: "justin1ogonowski@gmail.com", phone: "845 656 0241", mc: "", dot: "", license: "", deactivated: "" },
  { id: "18", name: "Adam Ogonowski", identifier: "", email: "adam1ogonowski@gmail.com", phone: "845-656-0392", mc: "", dot: "", license: "", deactivated: "" },
  { id: "20", name: "Joshua Hernandez", identifier: "", email: "jhernandez5336@gmail.com", phone: "845 709 0014", mc: "", dot: "", license: "743066529", deactivated: "" },
  { id: "21", name: "Willie Landivar", identifier: "", email: "Pinstripes27@aol.com", phone: "845 216 2381", mc: "", dot: "", license: "136 949 304", deactivated: "11/19/25 0:00" },
  { id: "22", name: "Olmar Salazar", identifier: "", email: "Ivansalazarj815@gmail.com", phone: "845-327-7114", mc: "", dot: "", license: "333 294 787 NY  expires 6/20/2026", deactivated: "2/26/26 0:00" },
  { id: "23", name: "Stewart Matthew", identifier: "", email: "geniusnyc87@gmail.com", phone: "845-674-5197", mc: "", dot: "", license: "376 406 223 NY 3/18/2032", deactivated: "" },
  { id: "25", name: "Juan Pineda-Aguilar", identifier: "", email: "pinedajuan78@gmail.com", phone: "845 401 1416", mc: "", dot: "", license: "721271930", deactivated: "2/26/26 0:00" },
  { id: "26", name: "Eric Hill", identifier: "", email: "silentknightenterprise@gmail.com", phone: "845-542-2140", mc: "", dot: "", license: "", deactivated: "" },
  { id: "27", name: "Liam Dellova", identifier: "", email: "LIAM@DELLOVA.COM", phone: "845 395 8009", mc: "", dot: "", license: "", deactivated: "" },
  { id: "28", name: "Carolyn Ogonowski", identifier: "", email: "cnogonowski@gmail.com", phone: "845-527-2992", mc: "", dot: "", license: "", deactivated: "" },
  { id: "29", name: "Xavier Webb", identifier: "XAVIER", email: "XAVIERWEBBCASTRO@GMAIL.COM", phone: "845 391 4194", mc: "", dot: "", license: "685963602 NY", deactivated: "" },
  { id: "30", name: "Christian Herrera", identifier: "", email: "theseeighteenwheels@gmail.com", phone: "551 330 1597", mc: "", dot: "", license: "H27431240001912", deactivated: "" },
];

// Skipped: row 1 (Kyle Miller - identifier "km", no real data), row 16 (Dream Team - group not individual),
//          row 19 (Katy - VehicleHaul staff), rows 24 & 31 (empty)

function buildDriver(row) {
  const lic = parseLicense(row.license);
  // Handle Olmar's "expires" in license field
  const licNum = lic.number.replace(/expires\s*/i, "").trim();
  const deactivated = parseDate(row.deactivated);
  const isInactive = !!deactivated;

  return {
    id: crypto.randomUUID().slice(0, 12),
    name: row.name,
    identifier: row.identifier || null,
    phone: cleanPhone(row.phone),
    email: row.email.toLowerCase(),
    license_number: licNum,
    license_state: lic.state || null,
    license_expiry: lic.expiry || null,
    mc_number: row.mc || null,
    dot_number: row.dot || null,
    status: isInactive ? "inactive" : "active",
    hire_date: "",
    deactivated_date: deactivated || null,
    total_miles: 0,
    total_earnings: 0,
    notes: null,
  };
}

async function main() {
  // First, add new columns to drivers table
  const alterSql = `
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS identifier TEXT;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_state TEXT;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS mc_number TEXT;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS dot_number TEXT;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deactivated_date TEXT;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notes TEXT;
  `;

  console.log("Adding new columns to drivers table...");
  // Execute via Supabase RPC or direct SQL isn't available via REST, so we'll just upsert
  // The user will need to run the ALTER TABLE SQL in the Supabase SQL Editor

  const drivers = csvRows.map(buildDriver);

  console.log(`\nParsed ${drivers.length} drivers:`);
  const active = drivers.filter(d => d.status === "active");
  const inactive = drivers.filter(d => d.status === "inactive");
  console.log(`  Active: ${active.length}`);
  console.log(`  Inactive: ${inactive.length}`);
  console.log("");

  // Show them
  for (const d of drivers) {
    console.log(`  ${d.status === "active" ? "✓" : "✗"} ${d.name} | ${d.phone} | lic: ${d.license_number || "—"} ${d.license_state || ""} exp ${d.license_expiry || "—"}`);
  }

  // Upsert to Supabase
  console.log("\nUpserting to Supabase...");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/drivers`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(drivers),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Supabase error ${res.status}: ${err}`);
    console.log("\n⚠️  You likely need to add the new columns first. Run this SQL in Supabase SQL Editor:\n");
    console.log(alterSql);
    process.exit(1);
  }

  console.log(`\n✓ ${drivers.length} drivers upserted to Supabase.`);
  console.log("  Refresh the app to see them in the Drivers page.");
}

main().catch(console.error);
