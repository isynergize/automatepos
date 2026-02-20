# AutomatePOS — Back Office Automation PoC

A fullstack proof-of-concept for automating purchase orders, invoice processing, and back office accounting workflows. Built with Next.js 16, Prisma, SQLite, and Recharts.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | SQLite via Prisma ORM |
| Charts | Recharts |
| Real-time | Server-Sent Events (SSE) |
| Runtime | Node.js 20 |

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up the database
```bash
npx prisma migrate dev
```

### 3. Seed pseudo data
```bash
npm run db:seed
```
Generates 15 purchase orders (varying statuses) and 12 invoices (6 processed + linked POs, 4 unprocessed, 2 failed) with automation run history.

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Route Map

### Pages
| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, charts, failure alert panel, PO simulator |
| `/purchase-orders` | Purchase order list with real-time SSE updates |
| `/invoices` | Invoice list with Generate PO automation trigger |
| `/invoices/history` | Automation run timeline with success/failure detail |

### API Routes
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/purchase-orders` | List all POs (with recent activity logs) |
| `POST` | `/api/purchase-orders` | Create a PO (random if no body) |
| `GET` | `/api/purchase-orders/[id]` | Get a single PO with full activity log |
| `PATCH` | `/api/purchase-orders/[id]` | Update PO status or fields |
| `GET` | `/api/purchase-orders/stream` | SSE stream for real-time PO events |
| `GET` | `/api/invoices` | List all invoices (with latest automation run) |
| `POST` | `/api/invoices` | Create an invoice (random if no body) |
| `GET` | `/api/invoices/[id]` | Get a single invoice with automation history |
| `PATCH` | `/api/invoices/[id]` | Update invoice status or fields |
| `POST` | `/api/invoices/[id]/generate-po` | Trigger invoice-to-PO automation |
| `GET` | `/api/automation-runs` | List all automation runs with invoice info |
| `GET` | `/api/dashboard/stats` | Aggregated metrics for the dashboard |
| `POST` | `/api/simulator` | Advance a random PO to its next status |

---

## Data Models

```
PurchaseOrder
  id          cuid
  vendor      String
  items       String   (JSON → LineItem[])
  total       Float
  status      pending | ordered | delivered | received
  createdAt   DateTime
  updatedAt   DateTime
  activityLogs ActivityLog[]

Invoice
  id          cuid
  vendor      String
  lineItems   String   (JSON → LineItem[])
  total       Float
  status      unprocessed | processing | processed | failed
  linkedPOId  String?  (FK to PurchaseOrder.id)
  createdAt   DateTime
  updatedAt   DateTime
  automationRuns AutomationRun[]

AutomationRun
  id          cuid
  invoiceId   String   (FK to Invoice.id)
  poId        String?  (FK to PurchaseOrder.id, null if failed)
  status      processing | success | failed
  details     String?  (JSON → { vendor, total, itemCount } or { error })
  startedAt   DateTime
  completedAt DateTime?

ActivityLog
  id          cuid
  entityType  String   (purchase_order | invoice)
  entityId    String
  action      String   (created | status_changed | created_from_invoice)
  details     String?  (JSON)
  timestamp   DateTime
  purchaseOrderId String? (FK to PurchaseOrder.id)

LineItem (embedded JSON in items / lineItems fields)
  name        String
  quantity    number
  unitPrice   number
  total       number
```

---

## Feature Overview

### Real-time Purchase Order Stream
The `/api/purchase-orders/stream` endpoint uses Server-Sent Events to push status changes and new PO creation events to all connected clients. The `useEventStream` hook (`src/hooks/useEventStream.ts`) manages the connection with automatic reconnect. The SSE subscriber registry uses a closed-state guard to prevent writes to disconnected clients.

### Invoice-to-PO Automation
`POST /api/invoices/[id]/generate-po` runs a multi-step flow:
1. Sets invoice status → `processing`
2. Creates an `AutomationRun` record (status: `processing`)
3. Parses invoice line items → creates a matching `PurchaseOrder`
4. Writes an `ActivityLog` entry linking invoice to PO
5. Sets invoice status → `processed`, sets `linkedPOId`
6. Updates `AutomationRun` → `success`

On any failure, the invoice reverts to `failed` and the `AutomationRun` captures the error message in its `details` JSON field.

### PO Status Simulator
The `/api/simulator` endpoint picks a random non-completed PO and advances it one step along the status flow (`pending → ordered → delivered → received`). The dashboard exposes a Start/Stop toggle that calls this every 3 seconds, useful for demoing real-time updates.

### Failure Alert Panel
The dashboard displays a red alert panel when any failed automation runs or unprocessed failed invoices exist. Each row shows vendor, amount, time since failure, the error message, and a direct Retry button that re-runs the automation in place.

---

## Epic Breakdown

### Epic 1 — Foundation & Purchase Order System ✅

| Task | Status | Description |
|------|--------|-------------|
| 1.1 Project scaffolding | Done | Next.js 16, TypeScript, Tailwind, App Router |
| 1.2 Database setup | Done | SQLite + Prisma, `.env` config |
| 1.3 PO data model | Done | `PurchaseOrder` schema with status flow |
| 1.4 Activity log model | Done | `ActivityLog` schema for event history |
| 1.5 Seed script | Done | 15 pseudo POs with randomized vendors/items/statuses |
| 1.6 PO API routes | Done | GET list, POST create, PATCH status |
| 1.7 Event stream route | Done | SSE with closed-controller guard |
| 1.8 Base layout | Done | Sidebar navigation with active state |
| 1.9 PO list page | Done | Table with status badges, timestamps |
| 1.10 Real-time hook | Done | `useEventStream` with auto-reconnect |
| 1.11 PO status simulator | Done | `/api/simulator` + dashboard toggle |

### Epic 2 — Invoice Automation & Dashboard ✅

| Task | Status | Description |
|------|--------|-------------|
| 2.1 Invoice data model | Done | `Invoice` schema with status flow |
| 2.2 Automation history model | Done | `AutomationRun` with timing and error capture |
| 2.3 Invoice seed data | Done | 12 invoices (processed, unprocessed, failed) |
| 2.4 Invoice API routes | Done | GET, POST, PATCH |
| 2.5 Automation endpoint | Done | `generate-po` with full audit trail |
| 2.6 Invoice list page | Done | Table with Generate PO button, linked PO status |
| 2.7 Automation history page | Done | Timeline with error detail, duration, success rate |
| 2.8 Dashboard stats API | Done | Parallel queries, activity by day, failure metrics |
| 2.9 Dashboard page | Done | Stat cards, activity line chart, automation health |
| 2.10 Dashboard charts | Done | PO pie, invoice pie, 7-day activity line chart |

### Post-Epic Improvements ✅

| Change | Description |
|--------|-------------|
| SSE controller fix | Added `closed` flag + `doCleanup` guard to prevent writes to disconnected stream controllers |
| Failure alert panel | Dashboard panel surfacing failed runs with error messages and inline Retry buttons |
| `recentFailures` stats API | Parallel query for failed automation runs with invoice relation included |

---

## Planned Changes

### Document Preview Modal
**Status: Planned**

Click any Invoice or PO row to open a modal showing the full document:

```
┌───────────────────────────────────────────┐
│  Invoice #abc123                    [×]   │
│  Vendor: Acme Supplies Co.                │
│  Status: ● Failed · Feb 20, 2026          │
├───────────────────────────────────────────┤
│  Item           Qty   Unit Price   Total  │
│  Paper Reams     10     $12.00    $120.00 │
│  Printer Ink      5     $45.00    $225.00 │
│  Staplers         2     $18.00     $36.00 │
├───────────────────────────────────────────┤
│  Grand Total                     $381.00  │
├───────────────────────────────────────────┤
│  ⚠ Error: Vendor not found in list        │
│                       [Retry Automation]  │
└───────────────────────────────────────────┘
```

- Invoice modal: line items, error section + Retry button if failed
- PO modal: line items, status history from activity log
- Backdrop click or ESC closes the modal

**Files to create/modify:**
- `src/components/DocumentModal.tsx` ← new shared component
- `src/app/invoices/page.tsx` ← add row click + modal state
- `src/app/purchase-orders/page.tsx` ← add row click + modal state
- `src/app/page.tsx` ← replace dashboard Retry with Review → modal

### Error Review Workflow
**Status: Planned**

Replaces the single-click Retry with a review-first flow:

```
failed
  → click row / "Review" button
  → modal opens: full document + error detail
  → click "Retry Automation"
  → status: processing
  → success: modal closes, row → processed
  → failure: modal stays open, new error shown
```

No new status states required. No API changes required — `generate-po` already handles the `failed → processing → processed/failed` transition correctly.

---

## Project Structure

```
/automtatepos
├── /prisma
│   ├── schema.prisma          Data models
│   ├── seed.ts                Pseudo data generator
│   └── /migrations            Migration history
├── /src
│   ├── /app
│   │   ├── /api
│   │   │   ├── /purchase-orders    PO CRUD + SSE stream
│   │   │   ├── /invoices           Invoice CRUD + generate-po
│   │   │   ├── /automation-runs    History endpoint
│   │   │   ├── /dashboard          Aggregated stats
│   │   │   └── /simulator          PO status advancer
│   │   ├── /purchase-orders        PO list page
│   │   ├── /invoices
│   │   │   ├── page.tsx            Invoice list page
│   │   │   └── /history            Automation run timeline
│   │   ├── layout.tsx              App shell with sidebar
│   │   └── page.tsx                Dashboard
│   ├── /components
│   │   ├── Sidebar.tsx             Navigation
│   │   └── StatusBadge.tsx         Reusable status chip
│   ├── /hooks
│   │   └── useEventStream.ts       SSE consumer with reconnect
│   └── /lib
│       ├── prisma.ts               Singleton Prisma client
│       ├── generators.ts           Pseudo data factories
│       ├── events.ts               In-process event bus (SSE)
│       └── types.ts                Shared TypeScript types
└── package.json
```
