-- Addresses — physical pickup/delivery locations (separate from customers)
CREATE TABLE IF NOT EXISTS addresses (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  line1 text DEFAULT '',
  line2 text,
  city text DEFAULT '',
  state text DEFAULT '',
  zip text DEFAULT '',
  notes text
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON addresses FOR ALL USING (true) WITH CHECK (true);
