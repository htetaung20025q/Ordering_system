# UI/UX & LAYOUT BLUEPRINT SPECIFICATION
# FLOW-SYS QR ORDERING & RESTAURANT SYSTEM

**Document Version:** 1.0 — Approved Specification  
**Design System Standards:** Token-Driven Architecture, Domain-Adaptive UX, ASCII Wireframes

---

## 1. DESIGN TOKENS (SINGLE SOURCE OF TRUTH)

All styling throughout the application is driven by centralized CSS variables and Tailwind theme tokens. No hex colors, spacing, or radii are hardcoded directly into components.

```css
:root {
  /* Color Palette */
  --bg-primary: #f8fafc;        /* Slate-50: Main app background */
  --surface: #ffffff;           /* Pure white: Cards, modals, drawers */
  --surface-subtle: #f1f5f9;    /* Slate-100: Table headers, pill backgrounds */
  
  --accent: #e21b70;            /* FoodPanda Signature Rose/Pink */
  --accent-hover: #d70f64;      /* Deepened pink for interaction */
  --accent-soft: #fff1f5;       /* Pink-50: Light tinted pill backgrounds */
  
  --text-main: #0f172a;         /* Slate-900: High-contrast primary typography */
  --text-muted: #64748b;        /* Slate-500: Subtitles, timestamps */
  --text-dim: #94a3b8;          /* Slate-400: Placeholder & secondary captions */
  
  --border-light: #e2e8f0;      /* Slate-200: Hairline borders */
  --border-focus: #e21b70;      /* Accessible focus rings */

  /* Operational Status Tokens */
  --status-pending: #3b82f6;    /* Blue-500: Incoming internal order */
  --status-confirmed: #8b5cf6;  /* Purple-500: Chef confirmed */
  --status-preparing: #06b6d4;  /* Cyan-500: Preparation active */
  --status-cooking: #f59e0b;    /* Amber-500: Cooking on stove/grill */
  --status-ready: #10b981;      /* Emerald-500: Plated & ready for pickup */
  --status-picked-up: #475569;  /* Slate-600: Completed terminal */

  /* Elevation & Shape Tokens */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

---

## 2. DOMAIN-ADAPTIVE UX PATTERNS

- **Customer Interface (Food Ordering):** High-converting visual cards, locked 1:1 image aspect ratios, sticky category pills, sticky bottom cart drawer, and prominent progress indicators. Zero login hurdle.
- **Chef KDS Screen (Kitchen Operations):** High-contrast dark/scannable theme, oversized typography readable from 2 meters away, station pills, one-click bump buttons, strict elimination of non-kitchen administrative noise.
- **Admin Panel (Operational Control):** Dense data tables, quick-action QR generation/printing bars, single-click table filtering (`Select Table ➔ Filter orders`).

---

## 3. UI LAYOUT BLUEPRINTS (ASCII WIREFRAMES)

### 3.1 Interface A — Customer Mobile Menu

```text
+---------------------------------------------------+
|  [Logo] FLOW-SYS Bistro            Table 04 [QR]  |
|  Seated at: Table 04 • Open • Yangon City         |
+---------------------------------------------------+
|  [Promo Banner: Fresh Chef Specials & Drinks]     |
+---------------------------------------------------+
|  [🔍 Search dishes, drinks, desserts...]          |
+---------------------------------------------------+
|  (🔥 All) (🍔 Mains) (🍹 Drinks) (🍰 Desserts)    |
+---------------------------------------------------+
|  +---------------------------------------------+  |
|  | [Img] Signature Truffle Burger   15,000 MMK |  |
|  |       Angus beef, truffle aioli  [+ Add]    |  |
|  +---------------------------------------------+  |
|  +---------------------------------------------+  |
|  | [Img] Craft IPA Beer (Chilled)    7,000 MMK |  |
|  |       Local brewery craft beer   [-] 2 [+]  |  |
|  +---------------------------------------------+  |
+---------------------------------------------------+
|  [🛒 View Basket (3 Items) • 29,000 MMK   ➔ ]     |
+---------------------------------------------------+
```

### 3.2 Interface A — Customer Order Tracking (4 Stages) & Digital Voucher

```text
+---------------------------------------------------+
|  <- Back to Menu              Active Order Tracker|
+---------------------------------------------------+
|  Order #ORD-20261115-1001 • Seated at: Table 04   |
|  Submitted at: 12:45 PM                           |
+---------------------------------------------------+
|  PROGRESS TIMELINE:                               |
|  [✓] Confirmed  ➔  [●] Prepare  ➔  [ ] Cooking ➔  |
|  [ ] Order Ready                                  |
|  ======================================           |
|  Current Status: CHEF CONFIRMED ORDER             |
+---------------------------------------------------+
|  +---------------------------------------------+  |
|  |  ORDER CONFIRMATION VOUCHER                 |  |
|  |  Voucher No: VCH-ORD-20261115-1001          |  |
|  |  Date: 15-Nov-2026, 12:46 PM                |  |
|  |  Status: Confirmed                          |  |
|  |                                             |  |
|  |  - Signature Truffle Burger  x1   15,000 MMK|  |
|  |  - Craft IPA Beer            x2   14,000 MMK|  |
|  |                                             |  |
|  |  Subtotal:                        29,000 MMK|  |
|  |  Tax (5%) + Service (10%):         4,350 MMK|  |
|  |  -----------------------------------------  |  |
|  |  TOTAL AMOUNT:                    33,350 MMK|  |
|  |  * Total amount only. Not a payment receipt |  |
|  +---------------------------------------------+  |
|  [ ⬇ Download Confirmation Voucher (PDF) ]        |
+---------------------------------------------------+
|  When your order reaches ORDER READY, please      |
|  proceed to the counter for Customer Pickup.      |
+---------------------------------------------------+
```

### 3.3 Interface C — Chef / Kitchen Display System (KDS Screen)

```text
+---------------------------------------------------------------------------------------+
|  🍳 FLOW-SYS KITCHEN DISPLAY SYSTEM                 Station: [All] [Kitchen] [Bar]   |
+---------------------------------------------------------------------------------------+
|  [TICKET #1001]           |  [TICKET #1002]           |  [TICKET #1003]               |
|  Table: Table 04          |  Table: Table 01          |  Table: Table 01              |
|  Time: 12:45 PM (3m ago)  |  Time: 12:48 PM (Just now)|  Time: 12:35 PM (13m ago)     |
|  Status: [CONFIRMED]      |  Status: [NEW / PENDING]  |  Status: [COOKING]            |
|---------------------------+---------------------------+-------------------------------|
|  1x Truffle Burger        |  2x Crispy Hot Chicken    |  1x Golden Truffle Fries      |
|     * Less spicy          |  1x Iced Lemon Tea        |  2x Molten Lava Cake          |
|  2x Craft IPA Beer        |                           |                               |
|---------------------------+---------------------------+-------------------------------|
|  [👨‍🍳 Start Prep ➔]      |  [✓ Confirm Order]        |  [✅ Mark as Ready ➔]         |
+---------------------------------------------------------------------------------------+
|  Tabs: [● Active Kitchen Orders (5)]               [✓ Ready for Pickup Counter (2)]   |
+---------------------------------------------------------------------------------------+
```

### 3.4 Interface B — Admin Panel: Table QR Management & Filtered Orders

```text
+---------------------------------------------------------------------------------------+
|  FLOW-SYS ADMIN PORTAL          Tables | QR Codes | Orders | Menu | Inventory         |
+---------------------------------------------------------------------------------------+
|  RESTAURANT TABLES & QR CODES                                                         |
|  + Add New Table     [Download All QRs (ZIP)]    [Print QR Stand Sheets]              |
+---------------------------------------------------------------------------------------+
|  Table No   Capacity   QR Status   Token Actions            Active Orders Filter     |
|  -----------------------------------------------------------------------------------  |
|  Table 01   4 Seats    [Active]    [Download SVG] [Rotate]  [View Orders (2)] ──┐     |
|  Table 02   2 Seats    [Active]    [Download SVG] [Rotate]  [View Orders (0)]   │     |
|  Table 03   6 Seats    [Active]    [Download SVG] [Rotate]  [View Orders (1)]   │     |
|  Table 04   4 Seats    [Active]    [Download SVG] [Rotate]  [View Orders (1)]   │     |
+---------------------------------------------------------------------------------│-----+
|                                                                                 │     |
|  FILTERED ORDER MONITOR: Table 01 <─────────────────────────────────────────────┘     |
|  Showing 2 independent orders for Table 01:                                           |
|  -----------------------------------------------------------------------------------  |
|  - Order #1002 | Time: 12:48 PM | Items: 3 | Total: 12,000 MMK | Status: [Prepare]    |
|  - Order #1003 | Time: 12:35 PM | Items: 3 | Total: 11,500 MMK | Status: [Cooking]    |
+---------------------------------------------------------------------------------------+
```

---

## 4. UI STATE MATRIX

Every component strictly supports 5 visual states:

1. **Loading State:** CSS shimmer skeleton loaders matching exact layout dimensions. Zero layout shift (`CLS = 0`).
2. **Empty State:** High-contrast contextual icons, informative message, and actionable buttons (`"No active orders for Table 01"`).
3. **Error State:** Human-readable explanations with retry triggers. Never leaks stack traces.
4. **Interactive States:** Distinct `:hover`, `:active`, and high-visibility `:focus-visible` outline rings for keyboard accessibility.
5. **Mobile-First Responsive Layout:** 100% viewport width and touch targets >= 44px on mobile devices.
