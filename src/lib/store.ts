import { Car, DispatchCodeDefinition, Driver, DriverBoardEntry, DriverDailyUpdate, Load, Expense, Invoice, LocationProfile, Vehicle } from "./types";

// Simple localStorage-backed store with event emitter for reactivity
type StoreKey = "cars" | "drivers" | "driverUpdates" | "driverBoards" | "dispatchCodes" | "locations" | "loads" | "expenses" | "invoices" | "vehicles";

const DEFAULTS: Record<StoreKey, unknown[]> = {
  cars: [
    { id: "car1", vin: "4T1DA1AB5RU123456", year: 2024, make: "Toyota", model: "Camry", vehicleName: "Toyota Camry XSE", color: "White", notes: "" },
    { id: "car2", vin: "1FTFW1E86SFA23456", year: 2025, make: "Ford", model: "F-150", vehicleName: "Ford F-150 XLT", color: "Blue", notes: "" },
    { id: "car3", vin: "5YJ3E1EA8RF345678", year: 2024, make: "Tesla", model: "Model 3", vehicleName: "Tesla Model 3 Rear-Wheel Drive", color: "Black", notes: "" },
  ] as Car[],
  drivers: [
    { id: "d1", name: "Marcus Williams", phone: "(404) 555-2318", email: "marcus.w@haulit.com", licenseNumber: "GA-CDL-88421", licenseExpiry: "2027-03-15", status: "active", hireDate: "2022-06-01", totalMiles: 87420, totalEarnings: 142600, assignedVehicleId: "v1" },
    { id: "d2", name: "Elena Rodriguez", phone: "(713) 555-9074", email: "elena.r@haulit.com", licenseNumber: "TX-CDL-33107", licenseExpiry: "2026-11-20", status: "active", hireDate: "2023-01-15", totalMiles: 54310, totalEarnings: 98200, assignedVehicleId: "v2" },
    { id: "d3", name: "Terrence Jackson", phone: "(305) 555-6641", email: "terrence.j@haulit.com", licenseNumber: "FL-CDL-72850", licenseExpiry: "2025-08-30", status: "active", hireDate: "2021-09-10", totalMiles: 112800, totalEarnings: 187400 },
    { id: "d4", name: "Rachel Kim", phone: "(214) 555-3389", email: "rachel.k@haulit.com", licenseNumber: "TX-CDL-19443", licenseExpiry: "2027-01-05", status: "on_leave", hireDate: "2023-07-20", totalMiles: 31200, totalEarnings: 54800 },
    { id: "d5", name: "David Chen", phone: "(678) 555-7712", email: "david.c@haulit.com", licenseNumber: "GA-CDL-55601", licenseExpiry: "2026-05-12", status: "active", hireDate: "2022-11-03", totalMiles: 68900, totalEarnings: 116300, assignedVehicleId: "v3" },
    { id: "d6", name: "James Peterson", phone: "(469) 555-1428", email: "james.p@haulit.com", licenseNumber: "TX-CDL-41772", licenseExpiry: "2025-09-18", status: "inactive", hireDate: "2020-03-14", totalMiles: 145600, totalEarnings: 231000 },
    { id: "d7", name: "Aisha Brooks", phone: "(770) 555-5503", email: "aisha.b@haulit.com", licenseNumber: "GA-CDL-68394", licenseExpiry: "2027-07-22", status: "active", hireDate: "2024-02-01", totalMiles: 12400, totalEarnings: 24600, assignedVehicleId: "v5" },
  ] as Driver[],
  driverUpdates: [
    { id: "u1", driverId: "d1", date: "2026-03-19", status: "en_route", location: "Birmingham, AL", milesDriven: 540, notes: "On schedule with Dallas to Atlanta shipment.", nextAction: "Morning ETA check-in before final leg.", createdAt: "2026-03-19T18:15:00.000Z" },
    { id: "u2", driverId: "d2", date: "2026-03-19", status: "available", location: "Houston, TX", milesDriven: 135, notes: "Trailer secured and paperwork cleared for dispatch.", nextAction: "Depart yard at 07:00 for Miami route.", createdAt: "2026-03-19T16:40:00.000Z" },
    { id: "u3", driverId: "d3", date: "2026-03-19", status: "delivered", location: "Houston, TX", milesDriven: 420, notes: "Completed Greenfield delivery with no exceptions.", nextAction: "Stand by for next assignment.", createdAt: "2026-03-19T14:25:00.000Z" },
    { id: "u4", driverId: "d5", date: "2026-03-19", status: "available", location: "Dallas, TX", milesDriven: 0, notes: "Back in yard after Southwest Dealers drop.", nextAction: "Truck wash and reset logs.", createdAt: "2026-03-19T11:10:00.000Z" },
    { id: "u5", driverId: "d7", date: "2026-03-19", status: "off_duty", location: "Atlanta, GA", milesDriven: 0, notes: "Off duty after prior delivery run.", nextAction: "Return Sunday evening for Monday dispatch.", createdAt: "2026-03-19T09:00:00.000Z" },
  ] as DriverDailyUpdate[],
  driverBoards: [
    {
      id: "b1",
      driverId: "d1",
      date: "2026-03-19",
      items: ["9-SBT", "8-SECOR"],
      stops: [
        { id: "b1s1", carCount: 9, pickupLocation: "SBT", dropoffLocation: "RK TAVERN", status: "completed", notes: "Morning route closed out the same day." },
        { id: "b1s2", carCount: 8, pickupLocation: "SECOR", dropoffLocation: "SHOP KEL", status: "held_overnight", overnightLocation: "SHOP KEL", notes: "Held in shop for next-day dispatch." },
      ],
      updatedAt: "2026-03-19T18:20:00.000Z",
    },
    {
      id: "b2",
      driverId: "d2",
      date: "2026-03-19",
      items: ["9-NBG", "9-DAG"],
      stops: [
        { id: "b2s1", carCount: 9, pickupLocation: "NBG", dropoffLocation: "FAMILY", status: "completed", notes: "Ford/Enfield run completed." },
        { id: "b2s2", carCount: 9, pickupLocation: "DAG", dropoffLocation: "SASI", status: "held_overnight", overnightLocation: "SHOP", notes: "Remaining cars held overnight at the shop." },
      ],
      updatedAt: "2026-03-19T17:45:00.000Z",
    },
    {
      id: "b3",
      driverId: "d3",
      date: "2026-03-19",
      items: ["1-HEALEY", "1-HV"],
      stops: [
        { id: "b3s1", carCount: 1, pickupLocation: "HEALEY", dropoffLocation: "HYUNDAI", status: "completed", notes: "Single-car move completed." },
        { id: "b3s2", carCount: 1, pickupLocation: "HV", dropoffLocation: "CJDR", status: "completed", notes: "Second move closed out late afternoon." },
      ],
      updatedAt: "2026-03-19T16:10:00.000Z",
    },
    {
      id: "b4",
      driverId: "d5",
      date: "2026-03-19",
      items: ["1-CURRY"],
      stops: [
        { id: "b4s1", carCount: 1, pickupLocation: "CURRY", dropoffLocation: "SUBARU", status: "held_overnight", overnightLocation: "SHOP", notes: "Vehicle staged for delivery the next morning." },
      ],
      updatedAt: "2026-03-19T13:00:00.000Z",
    },
  ] as DriverBoardEntry[],
  dispatchCodes: [
    { id: "c1", token: "OFF", meaning: "Driver is off duty.", kind: "status" },
    { id: "c2", token: "SHOP", meaning: "Truck is in the shop or yard service area.", kind: "status" },
  ] as DispatchCodeDefinition[],
  locations: [
    { id: "loc1", code: "SBT", name: "South Boston Transport", contactName: "Rina Cole", phone: "(617) 555-1022", email: "rina@sbtlogistics.com", address: "14 Terminal Rd, South Boston, MA", notes: "Morning pickup yard." },
    { id: "loc2", code: "SECOR", name: "Secor Auto Yard", contactName: "Tom Secor", phone: "(860) 555-2241", email: "dispatch@secorauto.com", address: "88 Industrial Ave, Hartford, CT", notes: "Often stages overnight." },
    { id: "loc3", code: "NBG", name: "Newburgh Lot", contactName: "Ava Martin", phone: "(845) 555-6620", email: "ava@newburghlot.com", address: "200 River Rd, Newburgh, NY", notes: "High-volume pickup location." },
    { id: "loc4", code: "DAG", name: "DAG Auto Exchange", contactName: "Chris Lane", phone: "(203) 555-3314", email: "ops@dagauto.com", address: "52 Commerce St, Danbury, CT", notes: "Regular pickup and dropoff." },
    { id: "loc5", code: "SASI", name: "SASI Distribution", contactName: "Kelly Ross", phone: "(914) 555-4418", email: "kross@sasi.com", address: "17 Warehouse Park, White Plains, NY", notes: "Common dealer stop." },
    { id: "loc6", code: "SHOP", name: "Main Shop", contactName: "Service Desk", phone: "(718) 555-9911", email: "shop@autotransport.com", address: "9 Fleet Way, Bronx, NY", notes: "Use for overnight holds and shop staging." },
    { id: "loc7", code: "CURRY", name: "Curry Auto", contactName: "Nate Curry", phone: "(845) 555-7715", email: "nate@curryauto.com", address: "61 Dealer Row, Kingston, NY", notes: "" },
    { id: "loc8", code: "HEALEY", name: "Healey Brothers", contactName: "Morgan Diaz", phone: "(845) 555-7833", email: "morgan@healeybros.com", address: "715 Route 17K, Newburgh, NY", notes: "" },
    { id: "loc9", code: "HV", name: "Hudson Valley Auto", contactName: "Lena Price", phone: "(845) 555-4488", email: "dispatch@hvauto.com", address: "31 Valley Dr, Poughkeepsie, NY", notes: "" },
    { id: "loc10", code: "RK TAVERN", name: "RK Tavern Storage", contactName: "Rick Tanner", phone: "(413) 555-4400", email: "rick@rktavernstorage.com", address: "4 Depot Ln, Springfield, MA", notes: "Drop yard." },
    { id: "loc11", code: "FAMILY", name: "Family Ford", contactName: "Amy Ford", phone: "(860) 555-2055", email: "amy@familyford.com", address: "320 Main St, Enfield, CT", notes: "" },
    { id: "loc12", code: "HYUNDAI", name: "Hudson Hyundai", contactName: "Eric Boone", phone: "(914) 555-6200", email: "eric@hudsonhyundai.com", address: "18 Auto Plaza, Yonkers, NY", notes: "" },
    { id: "loc13", code: "CJDR", name: "CJDR Auto Mall", contactName: "Jared Cole", phone: "(845) 555-8841", email: "jcole@cjdrautomall.com", address: "77 Dealer Blvd, Kingston, NY", notes: "" },
    { id: "loc14", code: "SUBARU", name: "Subaru Center", contactName: "Pat Nguyen", phone: "(203) 555-3310", email: "pat@subarucenter.com", address: "420 Market Rd, Danbury, CT", notes: "" },
    { id: "loc15", code: "SHOP KEL", name: "Kelly Shop", contactName: "Kelly Tran", phone: "(718) 555-3151", email: "kelly@kellyshop.com", address: "81 Service Rd, Bronx, NY", notes: "Overflow overnight shop." },
  ] as LocationProfile[],
  loads: [
    { id: "l1", referenceNumber: "LD-2026-0147", customer: "Greenfield Motors", customerPhone: "(512) 555-3200", pickupLocation: "Dallas, TX", deliveryLocation: "Atlanta, GA", pickupDate: "2026-03-18", deliveryDate: "2026-03-20", vehicleInfo: "2024 Toyota Camry (x3)", status: "in_transit", driverId: "d1", price: 2850, notes: "Three sedans, covered transport" },
    { id: "l2", referenceNumber: "LD-2026-0148", customer: "Apex Auto Group", customerPhone: "(404) 555-8900", pickupLocation: "Houston, TX", deliveryLocation: "Miami, FL", pickupDate: "2026-03-19", deliveryDate: "2026-03-22", vehicleInfo: "2025 Ford F-150 (x2)", status: "dispatched", driverId: "d2", price: 3400, notes: "" },
    { id: "l3", referenceNumber: "LD-2026-0149", customer: "Lakeside Imports", customerPhone: "(305) 555-4411", pickupLocation: "Jacksonville, FL", deliveryLocation: "Charlotte, NC", pickupDate: "2026-03-20", deliveryDate: "2026-03-21", vehicleInfo: "2023 BMW X5", status: "booked", price: 1200, notes: "Enclosed trailer required" },
    { id: "l4", referenceNumber: "LD-2026-0150", customer: "Southwest Dealers", customerPhone: "(210) 555-6677", pickupLocation: "Phoenix, AZ", deliveryLocation: "Dallas, TX", pickupDate: "2026-03-15", deliveryDate: "2026-03-17", vehicleInfo: "2024 Honda Accord (x4)", status: "delivered", driverId: "d5", price: 4200, notes: "Delivery confirmed" },
    { id: "l5", referenceNumber: "LD-2026-0151", customer: "Greenfield Motors", customerPhone: "(512) 555-3200", pickupLocation: "Nashville, TN", deliveryLocation: "Houston, TX", pickupDate: "2026-03-16", deliveryDate: "2026-03-18", vehicleInfo: "2025 Chevrolet Tahoe (x2)", status: "delivered", driverId: "d3", price: 3100, notes: "" },
    { id: "l6", referenceNumber: "LD-2026-0152", customer: "Premier Auto Sales", customerPhone: "(678) 555-2240", pickupLocation: "Atlanta, GA", deliveryLocation: "Orlando, FL", pickupDate: "2026-03-22", deliveryDate: "2026-03-23", vehicleInfo: "2024 Tesla Model 3 (x2)", status: "booked", price: 1800, notes: "EV — confirm charger compatibility" },
    { id: "l7", referenceNumber: "LD-2026-0153", customer: "Apex Auto Group", customerPhone: "(404) 555-8900", pickupLocation: "Savannah, GA", deliveryLocation: "Tampa, FL", pickupDate: "2026-03-14", deliveryDate: "2026-03-15", vehicleInfo: "2023 Jeep Wrangler", status: "delivered", driverId: "d7", price: 950, notes: "" },
  ] as Load[],
  expenses: [
    { id: "e1", date: "2026-03-18", category: "fuel", amount: 487.30, description: "Diesel fill-up — Dallas terminal", driverId: "d1", vehicleId: "v1" },
    { id: "e2", date: "2026-03-17", category: "tolls", amount: 62.50, description: "I-20 & I-75 tolls", driverId: "d1" },
    { id: "e3", date: "2026-03-16", category: "maintenance", amount: 1240, description: "Brake pad replacement & inspection", vehicleId: "v4" },
    { id: "e4", date: "2026-03-15", category: "fuel", amount: 523.10, description: "Diesel fill-up — Houston yard", driverId: "d2", vehicleId: "v2" },
    { id: "e5", date: "2026-03-14", category: "insurance", amount: 3200, description: "Monthly fleet insurance premium" },
    { id: "e6", date: "2026-03-13", category: "fuel", amount: 398.75, description: "Diesel fill-up — Savannah", driverId: "d7", vehicleId: "v5" },
    { id: "e7", date: "2026-03-12", category: "misc", amount: 175, description: "DOT compliance stickers & placards" },
    { id: "e8", date: "2026-03-10", category: "maintenance", amount: 890, description: "Tire rotation & alignment", vehicleId: "v3" },
    { id: "e9", date: "2026-03-08", category: "fuel", amount: 445.60, description: "Diesel fill-up — Phoenix", driverId: "d5", vehicleId: "v3" },
    { id: "e10", date: "2026-03-05", category: "tolls", amount: 38.25, description: "Florida Turnpike", driverId: "d3" },
  ] as Expense[],
  invoices: [
    { id: "inv1", invoiceNumber: "INV-2026-0071", loadId: "l4", customer: "Southwest Dealers", amount: 4200, status: "paid", issuedDate: "2026-03-17", dueDate: "2026-04-01", paidDate: "2026-03-19" },
    { id: "inv2", invoiceNumber: "INV-2026-0072", loadId: "l5", customer: "Greenfield Motors", amount: 3100, status: "sent", issuedDate: "2026-03-18", dueDate: "2026-04-02" },
    { id: "inv3", invoiceNumber: "INV-2026-0073", loadId: "l7", customer: "Apex Auto Group", amount: 950, status: "paid", issuedDate: "2026-03-15", dueDate: "2026-03-30", paidDate: "2026-03-18" },
    { id: "inv4", invoiceNumber: "INV-2026-0074", loadId: "l1", customer: "Greenfield Motors", amount: 2850, status: "draft", issuedDate: "2026-03-20", dueDate: "2026-04-04" },
    { id: "inv5", invoiceNumber: "INV-2026-0075", loadId: "l2", customer: "Apex Auto Group", amount: 3400, status: "draft", issuedDate: "2026-03-20", dueDate: "2026-04-04" },
  ] as Invoice[],
  vehicles: [
    {
      id: "v1",
      year: 2022,
      make: "Peterbilt",
      model: "579",
      vin: "1XPBD49X1ND123456",
      licensePlate: "GA-TRK-4418",
      status: "active",
      assignedDriverId: "d1",
      mileage: 184220,
      notes: "Primary Atlanta route truck.",
      maintenanceLog: [
        { id: "m1", date: "2026-03-01", type: "Oil Change", mileage: 183500, details: "Synthetic oil and filter replacement." },
        { id: "m2", date: "2026-02-11", type: "Brake Service", mileage: 181920, details: "Rear pads replaced." },
      ],
    },
    {
      id: "v2",
      year: 2023,
      make: "Freightliner",
      model: "Cascadia",
      vin: "3AKJHHDR5NSAB7890",
      licensePlate: "TX-TRK-7721",
      status: "active",
      assignedDriverId: "d2",
      mileage: 126810,
      notes: "",
      maintenanceLog: [
        { id: "m3", date: "2026-03-12", type: "Tire Rotation", mileage: 126200, details: "All drive tires rotated." },
      ],
    },
    {
      id: "v3",
      year: 2021,
      make: "Kenworth",
      model: "T680",
      vin: "1XKYD49X8MJ654321",
      licensePlate: "GA-TRK-3305",
      status: "active",
      assignedDriverId: "d5",
      mileage: 212405,
      notes: "Watch coolant sensor.",
      maintenanceLog: [
        { id: "m4", date: "2026-03-15", type: "Sensor Check", mileage: 212100, details: "Coolant sensor intermittent but usable." },
      ],
    },
    {
      id: "v4",
      year: 2020,
      make: "International",
      model: "LT",
      vin: "3HSDJSJR2LN112233",
      licensePlate: "TX-TRK-9908",
      status: "maintenance",
      mileage: 238970,
      notes: "Waiting on shop parts.",
      maintenanceLog: [
        { id: "m5", date: "2026-03-18", type: "Brake Repair", mileage: 238970, details: "Front caliper replacement pending." },
      ],
    },
    {
      id: "v5",
      year: 2024,
      make: "Volvo",
      model: "VNL 860",
      vin: "4V4NC9EH3RN445566",
      licensePlate: "GA-TRK-6612",
      status: "active",
      assignedDriverId: "d7",
      mileage: 74810,
      notes: "",
      maintenanceLog: [
        { id: "m6", date: "2026-03-08", type: "Oil Change", mileage: 74100, details: "Routine service complete." },
      ],
    },
    {
      id: "v6",
      year: 2019,
      make: "Mack",
      model: "Anthem",
      vin: "1M1AN07Y5KM778899",
      licensePlate: "FL-TRK-2201",
      status: "retired",
      mileage: 301550,
      notes: "Retired from active fleet.",
      maintenanceLog: [],
    },
  ] as Vehicle[],
};

function getStore<T>(key: StoreKey): T[] {
  try {
    const raw = localStorage.getItem(`transport_${key}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const defaults = DEFAULTS[key] as T[];
  localStorage.setItem(`transport_${key}`, JSON.stringify(defaults));
  return defaults;
}

function setStore<T>(key: StoreKey, data: T[]) {
  localStorage.setItem(`transport_${key}`, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("store-update", { detail: key }));
}

export function getDrivers(): Driver[] { return getStore<Driver>("drivers"); }
export function getCars(): Car[] { return getStore<Car>("cars"); }
export function getDriverUpdates(): DriverDailyUpdate[] { return getStore<DriverDailyUpdate>("driverUpdates"); }
export function getDriverBoards(): DriverBoardEntry[] { return getStore<DriverBoardEntry>("driverBoards"); }
export function getDispatchCodes(): DispatchCodeDefinition[] { return getStore<DispatchCodeDefinition>("dispatchCodes"); }
export function getLocations(): LocationProfile[] { return getStore<LocationProfile>("locations"); }
export function getLoads(): Load[] { return getStore<Load>("loads"); }
export function getExpenses(): Expense[] { return getStore<Expense>("expenses"); }
export function getInvoices(): Invoice[] { return getStore<Invoice>("invoices"); }
export function getVehicles(): Vehicle[] { return getStore<Vehicle>("vehicles"); }

export function saveDrivers(d: Driver[]) { setStore("drivers", d); }
export function saveCars(d: Car[]) { setStore("cars", d); }
export function saveDriverUpdates(d: DriverDailyUpdate[]) { setStore("driverUpdates", d); }
export function saveDriverBoards(d: DriverBoardEntry[]) { setStore("driverBoards", d); }
export function saveDispatchCodes(d: DispatchCodeDefinition[]) { setStore("dispatchCodes", d); }
export function saveLocations(d: LocationProfile[]) { setStore("locations", d); }
export function saveLoads(d: Load[]) { setStore("loads", d); }
export function saveExpenses(d: Expense[]) { setStore("expenses", d); }
export function saveInvoices(d: Invoice[]) { setStore("invoices", d); }
export function saveVehicles(d: Vehicle[]) { setStore("vehicles", d); }

export function getAppSetting(key: string): string | null {
  try {
    return localStorage.getItem(`transport_setting_${key}`);
  } catch {
    return null;
  }
}

export function saveAppSetting(key: string, value: string) {
  localStorage.setItem(`transport_setting_${key}`, value);
  window.dispatchEvent(new CustomEvent("store-update", { detail: `setting:${key}` }));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
