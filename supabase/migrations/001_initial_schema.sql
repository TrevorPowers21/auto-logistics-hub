-- Monroe Auto Transport — Initial Schema
-- Run this in the Supabase SQL Editor

-- Locations (Customers)
CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  contact_name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  license_number text DEFAULT '',
  license_expiry text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  hire_date text DEFAULT '',
  total_miles numeric DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  assigned_vehicle_id text,
  external_source text,
  external_id text,
  username text,
  timezone text,
  last_synced_at text,
  pay_rate_per_car numeric
);

-- Vehicles (Fleet)
CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY,
  year integer,
  make text DEFAULT '',
  model text DEFAULT '',
  vin text DEFAULT '',
  license_plate text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  assigned_driver_id text,
  mileage numeric,
  notes text DEFAULT '',
  external_source text,
  external_id text,
  last_synced_at text,
  last_known_location text,
  last_known_location_at text,
  last_known_latitude double precision,
  last_known_longitude double precision,
  last_known_speed_mph double precision,
  engine_state text
);

-- Vehicle Maintenance Log
CREATE TABLE IF NOT EXISTS vehicle_maintenance_log (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date text DEFAULT '',
  type text DEFAULT '',
  mileage numeric DEFAULT 0,
  details text DEFAULT ''
);

-- Loads
CREATE TABLE IF NOT EXISTS loads (
  id text PRIMARY KEY,
  reference_number text DEFAULT '',
  customer text DEFAULT '',
  customer_phone text DEFAULT '',
  pickup_location text DEFAULT '',
  delivery_location text DEFAULT '',
  pickup_date text DEFAULT '',
  delivery_date text DEFAULT '',
  vehicle_info text DEFAULT '',
  status text NOT NULL DEFAULT 'booked',
  driver_id text,
  price numeric DEFAULT 0,
  notes text DEFAULT ''
);

-- Cars
CREATE TABLE IF NOT EXISTS cars (
  id text PRIMARY KEY,
  vin text DEFAULT '',
  year integer,
  make text DEFAULT '',
  model text DEFAULT '',
  vehicle_name text DEFAULT '',
  color text,
  notes text,
  status text DEFAULT 'at_shop',
  load_id text,
  received_date text,
  delivered_date text,
  pickup_location text,
  delivery_location text,
  driver_id text,
  board_date text
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id text PRIMARY KEY,
  date text DEFAULT '',
  category text NOT NULL DEFAULT 'misc',
  amount numeric DEFAULT 0,
  description text DEFAULT '',
  driver_id text,
  vehicle_id text,
  business_line text,
  sales_car_id text
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  invoice_number text DEFAULT '',
  load_id text,
  customer text DEFAULT '',
  amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  issued_date text DEFAULT '',
  due_date text DEFAULT '',
  paid_date text
);

-- Driver Daily Updates
CREATE TABLE IF NOT EXISTS driver_daily_updates (
  id text PRIMARY KEY,
  driver_id text NOT NULL,
  date text DEFAULT '',
  status text DEFAULT 'available',
  location text DEFAULT '',
  miles_driven numeric DEFAULT 0,
  notes text DEFAULT '',
  next_action text DEFAULT '',
  created_at text DEFAULT ''
);

-- Driver Boards
CREATE TABLE IF NOT EXISTS driver_boards (
  id text PRIMARY KEY,
  driver_id text NOT NULL,
  date text DEFAULT '',
  items jsonb DEFAULT '[]',
  updated_at text DEFAULT ''
);

-- Driver Board Stops
CREATE TABLE IF NOT EXISTS driver_board_stops (
  id text PRIMARY KEY,
  board_id text NOT NULL REFERENCES driver_boards(id) ON DELETE CASCADE,
  car_count integer DEFAULT 0,
  pickup_location text DEFAULT '',
  dropoff_location text DEFAULT '',
  status text DEFAULT 'completed',
  overnight_location text,
  notes text,
  car_id text,
  pay_rate_per_car numeric,
  split_driver_id text,
  split_leg text
);

-- Dispatch Codes
CREATE TABLE IF NOT EXISTS dispatch_codes (
  id text PRIMARY KEY,
  token text DEFAULT '',
  meaning text DEFAULT '',
  kind text DEFAULT 'other'
);

-- Fuel Entries
CREATE TABLE IF NOT EXISTS fuel_entries (
  id text PRIMARY KEY,
  date text DEFAULT '',
  gallons numeric DEFAULT 0,
  cost_per_gallon numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  source text DEFAULT 'yard',
  driver_id text,
  vehicle_id text,
  location text,
  notes text
);

-- Planning Slots
CREATE TABLE IF NOT EXISTS planning_slots (
  id text PRIMARY KEY,
  date text DEFAULT '',
  driver_id text,
  load_summary text DEFAULT '',
  pickup_location text,
  delivery_location text,
  car_count integer,
  confirmed boolean DEFAULT false,
  notes text
);

-- App Settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text DEFAULT ''
);

-- Disable RLS on all tables (single shared account, no auth needed)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_board_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all access (open policies)
CREATE POLICY "allow_all" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vehicle_maintenance_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON loads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON cars FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON driver_daily_updates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON driver_boards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON driver_board_stops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON dispatch_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON fuel_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON planning_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
