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

export type DispatchStopStatus = "completed" | "held_overnight";

export interface DriverBoardStop {
  id: string;
  carCount: number;
  pickupLocation: string;
  dropoffLocation: string;
  status: DispatchStopStatus;
  overnightLocation?: string;
  notes?: string;
  carId?: string;
  payRatePerCar?: number; // pay per car for this specific stop
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
}

export type ExpenseCategory = "fuel" | "maintenance" | "tolls" | "insurance" | "misc";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  driverId?: string;
  vehicleId?: string;
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
