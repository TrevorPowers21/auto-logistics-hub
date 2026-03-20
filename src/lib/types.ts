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
}
