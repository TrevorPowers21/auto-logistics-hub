export type DriverStatus = "active" | "inactive" | "on_leave";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: DriverStatus;
  hireDate: string;
  totalMiles: number;
  totalEarnings: number;
  assignedVehicleId?: string;
  externalSource?: "samsara";
  externalId?: string;
  username?: string;
  timezone?: string;
  lastSyncedAt?: string;
  payRatePerCar?: number; // default pay rate per car moved
}

export type DriverDailyStatus = "available" | "en_route" | "delivered" | "delay" | "off_duty";

export interface DriverDailyUpdate {
  id: string;
  driverId: string;
  date: string;
  status: DriverDailyStatus;
  location: string;
  milesDriven: number;
  notes: string;
  nextAction: string;
  createdAt: string;
}

export interface DriverBoardEntry {
  id: string;
  driverId: string;
  date: string;
  items: string[];
  stops?: DriverBoardStop[];
  updatedAt: string;
}

export interface DispatchCodeDefinition {
  id: string;
  token: string;
  meaning: string;
  kind: "sequence" | "location" | "status" | "other";
}

export interface LocationProfile {
  id: string;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

// Physical addresses — where cars get picked up or dropped off
export interface Address {
  id: string;
  name: string;       // e.g. "Healey Brothers", "Main Shop", "Manheim Newburgh"
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
}

// "completed" = same driver picked up and delivered in one trip
// "overnight" = same driver picks up and delivers, but stops at yard/shop between legs
// "split" = one driver picks up, a different driver delivers
export type DispatchStopStatus = "completed" | "overnight" | "split";

export interface DriverBoardStop {
  id: string;
  customer?: string;  // customer code
  carCount: number;
  pickupLocation: string;
  dropoffLocation: string;
  status: DispatchStopStatus;
  overnightLocation?: string;
  notes?: string;
  carId?: string;
  payRatePerCar?: number; // pay per car for this specific stop/leg
  // Split-specific: which driver handles the other leg
  splitDriverId?: string;
  splitLeg?: "pickup" | "delivery"; // which leg THIS driver is doing
}

export type CarStatus = "at_shop" | "in_transit" | "delivered";

export interface Car {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  vehicleName: string;
  color?: string;
  notes?: string;
  // Movement tracking
  status?: CarStatus;
  loadId?: string;          // which Load this car belongs to
  receivedDate?: string;    // date car arrived at shop / was received
  deliveredDate?: string;   // date car was delivered to final destination
  pickupLocation?: string;  // where it was picked up from
  deliveryLocation?: string; // where it was delivered to
  driverId?: string;        // driver who moved/is moving this car
  boardDate?: string;       // date of board entry associated with this car
}

export type LoadStatus = "booked" | "dispatched" | "in_transit" | "delivered" | "cancelled";

export interface Load {
  id: string;
  referenceNumber: string;
  customer: string;
  customerPhone: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDate: string;
  deliveryDate: string;
  vehicleInfo: string;
  status: LoadStatus;
  driverId?: string;
  price: number;
  notes: string;
  carIds?: string[]; // linked Car records — cars on this load
}

export type BusinessLine = "auto_transport" | "auto_sales" | "towing";

export type ExpenseCategory = "fuel" | "maintenance" | "tolls" | "insurance" | "misc";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  driverId?: string;
  vehicleId?: string;
  businessLine?: BusinessLine;       // which business line this expense belongs to
  salesCarId?: string;               // if auto_sales, which car this expense is for
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  loadId: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  status: "active" | "maintenance" | "retired";
  assignedDriverId?: string;
  mileage?: number;
  notes?: string;
  maintenanceLog?: FleetMaintenanceEntry[];
  externalSource?: "samsara";
  externalId?: string;
  lastSyncedAt?: string;
  lastKnownLocation?: string;
  lastKnownLocationAt?: string;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  lastKnownSpeedMilesPerHour?: number;
  engineState?: string;
}

export interface FleetMaintenanceEntry {
  id: string;
  date: string;
  type: string;
  mileage: number;
  details: string;
}

// Fuel tracking — yard gallons
export interface FuelEntry {
  id: string;
  date: string;
  gallons: number;
  costPerGallon: number;
  totalCost: number;
  source: "yard" | "fleet_one";      // yard = Hudson View Oil manual, fleet_one = future
  driverId?: string;
  vehicleId?: string;
  location?: string;
  notes?: string;
}

// 3-Day Planning Board
export interface PlanningSlot {
  id: string;
  date: string;
  driverId?: string;           // can be blank — load entered before driver assigned
  customer?: string;           // customer code from locations
  loadSummary: string;         // auto-generated from fields
  pickupLocation?: string;
  deliveryLocation?: string;
  carCount?: number;
  confirmed: boolean;          // false = tentative, true = locked in
  notes?: string;
}
