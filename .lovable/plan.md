

# Auto Transport Management Dashboard

## Overview
A management dashboard for your auto transport company, designed for you and your dispatchers to track drivers, expenses, loads, and invoicing — replacing your current spreadsheet workflow.

## Pages & Features

### 1. Dashboard (Home)
- At-a-glance summary cards: total active loads, monthly expenses, active drivers, outstanding invoices
- Recent activity feed (new loads, completed deliveries, recent expenses)
- Revenue vs. expenses chart for the current month

### 2. Driver Management
- Driver directory with profiles: name, phone, license info, status (active/inactive/on leave)
- Assign drivers to loads
- View driver history (past loads, total miles, earnings)

### 3. Load / Shipment Tracking
- Create and manage loads: pickup/delivery locations, dates, vehicle details, customer info
- Status pipeline: Booked → Dispatched → In Transit → Delivered
- Filter and search by status, driver, date range, or customer

### 4. Expense Tracking
- Log expenses by category: fuel, maintenance, tolls, insurance, misc
- Attach expenses to specific vehicles or drivers
- Monthly expense summary with breakdown charts
- Filter by date range, category, driver, or vehicle

### 5. Invoicing & Payments
- Generate invoices from completed loads (auto-fill customer, route, price)
- Track invoice status: Draft → Sent → Paid → Overdue
- Payment recording and outstanding balance tracking

### 6. Vehicles
- Vehicle roster: year, make, model, VIN, status
- Link vehicles to drivers and expenses

## Design
- Clean, professional sidebar navigation
- Dark navy/blue accent colors for a business feel
- Responsive tables with search and filters
- All data stored locally initially (no backend) — can add Supabase database later for persistent storage and multi-user access

## Future Enhancements (not in initial build)
- User accounts for dispatchers (requires Supabase)
- Driver mobile portal
- Route optimization
- Stripe integration for customer payments

