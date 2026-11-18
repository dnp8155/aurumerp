# FlowGrid ERP — Migration Reference Document

> **Source:** Base44 (NoSQL) → **Target:** Supabase (Postgres)
> **Purpose:** Future migration ke time yeh document reference rahega. Jab bhi koi entity/field/function change ho, yahin update karte raho.
> **Last Updated:** 2026-09-17

---

## Table of Contents

1. [Database Tables (36 entities)](#1-database-tables)
2. [Auth & Roles (Supabase)](#2-auth--roles)
3. [RLS Policies](#3-rls-policies)
4. [Backend Functions → Edge Functions](#4-backend-functions--edge-functions)
5. [File Storage](#5-file-storage)
6. [Frontend Pages to Migrate](#6-frontend-pages-to-migrate)
7. [Migration Order](#7-migration-order)
8. [Update Log](#8-update-log)

---

## 1. Database Tables

### 1.1 Core / Master Tables

#### `stores`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen | |
| name | text | NOT NULL | |
| code | text | NOT NULL | |
| type | text | NOT NULL, CHECK IN ('head_office','store','warehouse') | default 'store' |
| address | text | | |
| city | text | | |
| state | text | | |
| phone | text | | |
| manager_name | text | | |
| gst_number | text | | |
| status | text | CHECK IN ('active','inactive') | default 'active' |
| created_date | timestamptz | default now() | |
| updated_date | timestamptz | default now() | |
| created_by_id | uuid | FK → auth.users | |

#### `vendors`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL |
| code | text | |
| contact_person | text | |
| phone | text | |
| email | text | |
| billing_address_line1 | text | |
| billing_address_line2 | text | |
| billing_address_area | text | |
| billing_address_city | text | |
| billing_address_state | text | |
| billing_address_pincode | text | |
| shipping_address_line1 | text | |
| shipping_address_line2 | text | |
| shipping_address_area | text | |
| shipping_address_city | text | |
| shipping_address_state | text | |
| shipping_address_pincode | text | |
| gst_number | text | |
| category | text | |
| calculation_rule_id | uuid | FK → calculation_rules |
| calculation_rule_name | text | |
| default_collection_code | text | |
| default_collection_name | text | |
| outstanding_amount | numeric | default 0 |
| notes | text | |
| status | text | default 'active', CHECK IN ('active','inactive') |
| rating | numeric | default 0, CHECK 0-5 |

#### `customers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL |
| customer_id | text | |
| email | text | |
| phone | text | |
| address_line1 | text | |
| address_line2 | text | |
| address_area | text | |
| city | text | |
| state | text | |
| pincode | text | |
| birthday | date | |
| loyalty_points | numeric | default 0 |
| offer_code | text | |
| customer_type | text | default 'walk_in', CHECK IN ('walk_in','registered','wholesale','vip') |
| total_orders | numeric | default 0 |
| total_spent | numeric | default 0 |
| status | text | default 'active' |
| notes | text | |

#### `employees`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL |
| contact_number | text | |
| address | text | |
| date_of_joining | date | |
| employee_id_1 | text | |
| employee_id_2 | text | |
| current_monthly_salary | numeric | |
| designation | text | |
| department | text | |
| branch | text | |
| status | text | default 'active', CHECK IN ('active','inactive') |

#### `transporters`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL |
| phone | text | |
| docket_number | text | |
| date_of_delivery | date | |
| expected_date_of_arrival | date | |
| reference_type | text | |
| reference_id | text | |
| reference_number | text | |
| status | text | default 'pending', CHECK IN ('pending','in_transit','delivered','delayed') |

#### `gst_registrations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| registration_name | text | NOT NULL |
| gst_number | text | NOT NULL |
| address_line1 | text | |
| address_line2 | text | |
| city | text | |
| state | text | |
| pincode | text | |
| is_default | boolean | default false |
| status | text | default 'active' |

---

### 1.2 Product & Catalog Tables

#### `products`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| sku | text | NOT NULL, UNIQUE |
| name | text | NOT NULL |
| vertical | text | NOT NULL, CHECK IN ('Art Jewellery','Bangles') |
| category | text | NOT NULL |
| sub_category | text | |
| attributes | jsonb | dynamic key-value |
| dominant_color | text | AI detected |
| images | text[] | array of URLs |
| videos | text[] | array of URLs |
| barcode | text | |
| cost_price | numeric | |
| selling_price | numeric | |
| mrp | numeric | |
| weight | numeric | grams |
| vendor_id | uuid | FK → vendors |
| vendor_name | text | |
| vendor_sku_code | text | |
| is_set | boolean | default false |
| set_components | jsonb | [{component_sku, component_name, quantity}] |
| status | text | default 'draft', CHECK IN ('draft','cataloged','active','discontinued') |
| purchase_date | date | |
| sale_date | date | |
| tally_synced | boolean | default false |

#### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| vertical | text | NOT NULL, CHECK IN ('Art Jewellery','Bangles') |
| name | text | NOT NULL |
| parent_category_id | uuid | FK → categories (self-ref) |
| parent_category_name | text | |
| sub_categories | text[] | |
| is_set | boolean | default false |
| display_order | numeric | default 0 |

#### `attribute_definitions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL |
| field_type | text | NOT NULL, CHECK IN ('text','number','decimal','select','multi_select','boolean','date','measurement','weight','dimension','color','stone','material') |
| allowed_values | text[] | |
| allow_custom | boolean | default true |
| is_required | boolean | default false |
| is_common | boolean | default false |
| display_order | numeric | default 0 |
| applicable_categories | text[] | |
| applicable_verticals | text[] | |
| department | text | NOT NULL, CHECK IN ('Design','Operations','Purchase','Sales','Marketing','HR') |
| permissions | jsonb | {ho, store_manager, accountant, admin} |

---

### 1.3 Purchase & Procurement Tables

#### `purchase_orders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| po_number | text | NOT NULL, UNIQUE |
| vendor_id | uuid | NOT NULL, FK → vendors |
| vendor_name | text | |
| vendor_gst_number | text | |
| company_gst_registration_id | uuid | FK → gst_registrations |
| company_gst_number | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| status | text | default 'pending_approval', CHECK IN ('draft','pending_approval','approved','rejected','partially_received','received','cancelled') |
| items | jsonb | array of line items (see below) |
| subtotal | numeric | default 0 |
| tax_amount | numeric | default 0 |
| total_amount | numeric | default 0 |
| expected_delivery | date | |
| notes | text | |
| approved_by | text | |
| approved_date | timestamptz | |
| tally_synced | boolean | default false |
| tally_sync_date | timestamptz | |
| payment_status | text | default 'unpaid', CHECK IN ('unpaid','partial','paid') |
| payable_amount | numeric | default 0 |

**PO items JSONB structure:**
```json
[{
  "product_name": "string",
  "sku": "string",
  "vendor_sku_code": "string",
  "product_code": "string",
  "short_code": "string",
  "quantity": number,
  "unit_price": number,
  "total_price": number,
  "pricing_mode": "automatic|manual_override",
  "pricing_rule_id": "uuid",
  "pricing_rule_version": number,
  "calculated_price": number,
  "manual_override_price": number,
  "final_price": number,
  "override_reason": "string",
  "override_user": "string",
  "calculation_timestamp": "datetime",
  "calculated_value": number,
  "p_value": number,
  "attributes": {}
}]
```

#### `goods_receipts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| receipt_number | text | NOT NULL |
| po_id | uuid | NOT NULL, FK → purchase_orders |
| po_number | text | |
| vendor_id | uuid | FK → vendors |
| vendor_name | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| received_date | timestamptz | |
| received_by | text | |
| status | text | default 'pending_qc', CHECK IN ('pending_qc','qc_in_progress','qc_completed','discrepancy') |
| items | jsonb | [{product_name, ordered_quantity, received_quantity, accepted_quantity, rejected_quantity, qc_status, discrepancy_reason}] |
| total_received | numeric | default 0 |
| total_accepted | numeric | default 0 |
| total_rejected | numeric | default 0 |
| discrepancy_notes | text | |

#### `vendor_pricing_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| vendor_id | uuid | NOT NULL, FK → vendors |
| vendor_name | text | |
| rule_name | text | NOT NULL |
| version_number | numeric | NOT NULL, default 1 |
| is_active | boolean | default true |
| steps | jsonb | [{sequence, operation: multiply/divide/add/subtract, operand}] |
| effective_from | date | |
| effective_to | date | |
| created_by | text | |
| notes | text | |
| status | text | default 'active' |

#### `price_override_audits`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| purchase_order_id | uuid | NOT NULL, FK → purchase_orders |
| po_number | text | |
| vendor_id | uuid | NOT NULL, FK → vendors |
| vendor_name | text | |
| item_index | numeric | |
| item_description | text | |
| buy_price | numeric | default 0 |
| pricing_rule_id | text | |
| pricing_rule_version | numeric | |
| calculated_price | numeric | default 0 |
| manual_price | numeric | NOT NULL |
| difference | numeric | default 0 |
| override_user | text | |
| override_reason | text | NOT NULL |

#### `calculation_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| rule_name | text | NOT NULL |
| multiplier | numeric | NOT NULL, default 6 |
| divisor | numeric | NOT NULL, default 3 |
| rounding_method | text | default 'roundup', CHECK IN ('roundup','round','floor') |
| stock_group_format | text | default 'name_partno', CHECK IN ('name_partno','name_hyphen_code','name_shortcode_code') |
| name_code | text | default '$' |
| default_unit | text | default 'Pcs' |
| effective_from | date | |
| effective_to | date | |
| is_active | boolean | default true |
| description | text | |

---

### 1.4 Inventory Tables

#### `inventory`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| product_id | uuid | NOT NULL, FK → products |
| sku | text | |
| product_name | text | |
| store_id | uuid | NOT NULL, FK → stores |
| store_name | text | |
| quantity | numeric | default 0 |
| reserved_quantity | numeric | default 0 |
| allocated_quantity | numeric | default 0 |
| sold_quantity | numeric | default 0 |
| returned_quantity | numeric | default 0 |
| damaged_quantity | numeric | default 0 |
| channel | text | default 'store', CHECK IN ('store','warehouse','ecommerce') |
| aging_status | text | default 'green', CHECK IN ('green','amber','red') |
| last_received_date | timestamptz | |
| min_stock_level | numeric | default 0 |
| location_bin | text | |

#### `inventory_movements`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| product_id | uuid | NOT NULL, FK → products |
| sku | text | |
| product_name | text | |
| movement_type | text | NOT NULL, CHECK IN ('opening_stock','purchase','sale','sales_return','purchase_return','transfer','damage','adjustment') |
| quantity_change | numeric | NOT NULL |
| reference_type | text | |
| reference_id | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| from_store_id | uuid | FK → stores |
| to_store_id | uuid | FK → stores |
| reason | text | |
| notes | text | |

#### `allocations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| allocation_number | text | NOT NULL |
| product_id | uuid | NOT NULL, FK → products |
| sku | text | |
| product_name | text | |
| from_store_id | uuid | FK → stores |
| from_store_name | text | |
| to_store_id | uuid | NOT NULL, FK → stores |
| to_store_name | text | |
| quantity | numeric | NOT NULL |
| channel | text | default 'store', CHECK IN ('store','warehouse','ecommerce') |
| status | text | default 'pending', CHECK IN ('pending','dispatched','received','discrepancy','cancelled') |
| pallet_id | uuid | FK → pallets |
| notes | text | |

#### `pallets`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| pallet_code | text | NOT NULL |
| destination_store_id | uuid | NOT NULL, FK → stores |
| destination_store_name | text | |
| source_store_id | uuid | FK → stores |
| source_store_name | text | |
| items | jsonb | [{product_id, sku, product_name, quantity}] |
| total_items | numeric | default 0 |
| total_quantity | numeric | default 0 |
| status | text | default 'created', CHECK IN ('created','dispatched','in_transit','received','discrepancy') |
| shipment_id | uuid | FK → shipments |
| barcode | text | |
| dispatched_date | timestamptz | |
| received_date | timestamptz | |

#### `shipments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| shipment_number | text | NOT NULL |
| type | text | NOT NULL, default 'outbound', CHECK IN ('inbound','outbound') |
| pallet_id | uuid | FK → pallets |
| pallet_code | text | |
| from_store_id | uuid | NOT NULL, FK → stores |
| from_store_name | text | |
| to_store_id | uuid | NOT NULL, FK → stores |
| to_store_name | text | |
| status | text | default 'created', CHECK IN ('created','dispatched','in_transit','received','discrepancy','cancelled') |
| tracking_number | text | |
| transporter | text | |
| dispatched_date | timestamptz | |
| received_date | timestamptz | |
| received_by | text | |
| discrepancy_notes | text | |

---

### 1.5 Sales Tables

#### `sales`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| sale_number | text | NOT NULL |
| store_id | uuid | NOT NULL, FK → stores |
| store_name | text | |
| items | jsonb | [{product_id, sku, product_name, quantity, unit_price, total_price, discount}] |
| subtotal | numeric | default 0 |
| tax_amount | numeric | default 0 |
| discount_amount | numeric | default 0 |
| total_amount | numeric | NOT NULL |
| payment_method | text | NOT NULL, CHECK IN ('cash','upi','card','net_banking','wallet') |
| payment_status | text | default 'paid', CHECK IN ('paid','pending','partial','refunded') |
| customer_id | uuid | FK → customers |
| customer_name | text | |
| customer_phone | text | |
| salesperson | text | |
| status | text | default 'completed', CHECK IN ('completed','returned','partial_return','cancelled') |
| sale_date | timestamptz | |
| cashier_name | text | |
| return_items | jsonb | [{product_id, sku, product_name, quantity, refund_amount}] |
| return_reason | text | |
| tally_synced | boolean | default false |

#### `orders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_number | text | NOT NULL |
| marketplace_order_id | text | |
| marketplace | text | default 'manual', CHECK IN ('shopify','amazon','website','manual') |
| last_synced_date | timestamptz | |
| customer_id | uuid | FK → customers |
| customer_name | text | |
| customer_email | text | |
| customer_phone | text | |
| shipping_address | text | |
| shipping_city | text | |
| shipping_state | text | |
| shipping_pincode | text | |
| items | jsonb | [{product_id, sku, product_name, quantity, unit_price, total_price, image_url}] |
| subtotal | numeric | default 0 |
| shipping_charge | numeric | default 0 |
| tax_amount | numeric | default 0 |
| total_amount | numeric | NOT NULL |
| payment_method | text | default 'prepaid', CHECK IN ('cod','prepaid','upi','card','net_banking') |
| payment_status | text | default 'pending', CHECK IN ('pending','paid','failed','refunded') |
| fulfillment_status | text | default 'pending', CHECK IN ('pending','confirmed','packed','dispatched','delivered','cancelled','returned') |
| channel | text | default 'website', CHECK IN ('website','app','marketplace','instagram','whatsapp') |
| tracking_number | text | |
| transporter | text | |
| assigned_store_id | uuid | FK → stores |
| assigned_store_name | text | |
| order_date | timestamptz | |
| delivery_date | timestamptz | |
| notes | text | |
| tally_synced | boolean | default false |

#### `returns`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| return_number | text | NOT NULL |
| original_sale_id | uuid | FK → sales |
| original_sale_number | text | |
| store_id | uuid | NOT NULL, FK → stores |
| store_name | text | |
| customer_name | text | |
| customer_phone | text | |
| items | jsonb | [{product_id, sku, product_name, original_quantity, return_quantity, unit_price, refund_amount, reason}] |
| total_refund | numeric | default 0 |
| return_type | text | default 'partial', CHECK IN ('full','partial') |
| return_reason | text | |
| return_date | timestamptz | |
| status | text | default 'pending', CHECK IN ('pending','approved','completed','rejected') |
| processed_by | text | |
| approved_by | text | |
| approved_date | timestamptz | |
| inventory_restocked | boolean | default false |
| refund_method | text | default 'cash', CHECK IN ('cash','upi','card','store_credit','bank_transfer') |
| notes | text | |
| tally_synced | boolean | default false |

#### `rentals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| rental_number | text | NOT NULL |
| customer_id | uuid | FK → customers |
| customer_name | text | NOT NULL |
| customer_phone | text | |
| customer_address | text | |
| store_id | uuid | NOT NULL, FK → stores |
| store_name | text | |
| items | jsonb | [{product_id, sku, product_name, quantity, rental_rate, rate_unit, rental_charge, security_deposit}] |
| rental_start_date | date | |
| rental_end_date | date | |
| actual_return_date | date | |
| rental_duration | numeric | default 0 |
| total_rental_charge | numeric | default 0 |
| security_deposit | numeric | default 0 |
| late_fee | numeric | default 0 |
| damage_charge | numeric | default 0 |
| total_payable | numeric | default 0 |
| payment_status | text | default 'pending', CHECK IN ('pending','partial','paid','refunded') |
| payment_method | text | CHECK IN ('cash','upi','card','net_banking','wallet') |
| status | text | default 'active', CHECK IN ('active','returned','overdue','cancelled','extended') |
| processed_by | text | |
| notes | text | |
| tally_synced | boolean | default false |

**Rental items JSONB structure:**
```json
[{
  "product_id": "uuid",
  "sku": "string",
  "product_name": "string",
  "quantity": number,
  "rental_rate": number,
  "rate_unit": "per_day|per_week|per_month|fixed",
  "rental_charge": number,
  "security_deposit": number
}]
```

#### `repairs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| repair_number | text | NOT NULL |
| customer_id | uuid | FK → customers |
| customer_name | text | NOT NULL |
| customer_phone | text | |
| product_id | uuid | FK → products |
| product_name | text | NOT NULL |
| product_sku | text | |
| product_barcode | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| issue_description | text | |
| customer_notes | text | |
| technician_notes | text | |
| repair_actions | jsonb | [{description, type, quantity, unit_cost, total_cost}] |
| estimated_cost | numeric | default 0 |
| actual_cost | numeric | default 0 |
| labor_charge | numeric | default 0 |
| parts_cost | numeric | default 0 |
| total_charge | numeric | default 0 |
| advance_paid | numeric | default 0 |
| balance_due | numeric | default 0 |
| payment_status | text | default 'unpaid', CHECK IN ('unpaid','advance','paid','refunded') |
| payment_method | text | CHECK IN ('cash','upi','card','net_banking','wallet') |
| warranty_claim | boolean | default false |
| warranty_reference | text | |
| technician_name | text | |
| received_date | date | |
| estimated_completion | date | |
| actual_completion | date | |
| delivered_date | date | |
| status | text | default 'received', CHECK IN ('received','diagnosing','in_progress','awaiting_parts','ready_for_delivery','delivered','cancelled','rejected') |
| priority | text | default 'medium', CHECK IN ('low','medium','high','urgent') |
| processed_by | text | |
| notes | text | |
| tally_synced | boolean | default false |

**Repair actions JSONB structure:**
```json
[{
  "description": "string",
  "type": "labor|part|other",
  "quantity": number,
  "unit_cost": number,
  "total_cost": number
}]
```

---

### 1.6 Finance Tables

#### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| expense_number | text | NOT NULL |
| category | text | NOT NULL, CHECK IN ('rent','utilities','salaries','procurement','marketing','logistics','maintenance','miscellaneous','taxes') |
| description | text | |
| amount | numeric | NOT NULL |
| gst_amount | numeric | default 0 |
| total_amount | numeric | |
| vendor_id | uuid | FK → vendors |
| vendor_name | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| payment_mode | text | default 'bank', CHECK IN ('cash','bank','upi','cheque','card') |
| status | text | default 'pending', CHECK IN ('pending','approved','paid','rejected') |
| expense_date | date | NOT NULL |
| approved_by | text | |
| notes | text | |
| tally_synced | boolean | default false |

#### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| transaction_number | text | NOT NULL |
| amount | numeric | NOT NULL |
| currency | text | default 'INR' |
| payment_method | text | NOT NULL, CHECK IN ('upi','card','cash','net_banking','wallet') |
| provider | text | |
| status | text | default 'pending', CHECK IN ('pending','success','failed','refunded','partial_refund') |
| reference_id | text | |
| store_id | uuid | FK → stores |
| store_name | text | |
| product_id | uuid | FK → products |
| customer_name | text | |
| customer_phone | text | |
| tally_synced | boolean | default false |
| transaction_date | timestamptz | |

#### `payment_configs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| provider | text | NOT NULL, CHECK IN ('stripe','upi','card_terminal','razorpay') |
| display_name | text | |
| is_active | boolean | default false |
| config | jsonb | encrypted provider config |
| supported_methods | text[] | |
| environment | text | default 'test', CHECK IN ('test','live') |

---

### 1.7 Barcode Tables

#### `barcode_records`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| barcode | text | NOT NULL |
| sku | text | |
| product_code | text | |
| product_name | text | NOT NULL |
| short_code | text | |
| price | numeric | |
| value | numeric | |
| p_value | numeric | |
| part_no | numeric | NOT NULL |
| des_part_no | text | NOT NULL |
| collection_code | text | |
| party_name | text | |
| store_code | text | |
| store_name | text | |
| stock_item_name | text | |
| alias | text | |
| stock_group | text | |
| description | text | |
| c1_code | text | |
| c2_code | text | |
| name_code | text | |
| unit | text | |
| calculation_rule_id | uuid | FK → calculation_rules |
| calculation_rule_name | text | |
| purchase_date | date | |
| source_transaction | text | |
| legacy_barcode | text | |
| label_quantity | numeric | default 1 |
| status | text | default 'active', CHECK IN ('active','sold','returned','damaged','transferred','inactive') |

#### `barcode_product_masters`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| product_code | text | NOT NULL |
| product_name | text | NOT NULL |
| short_code | text | NOT NULL |
| stock_group_code | text | |
| stock_group_template | text | |
| status | text | default 'active' |

#### `barcode_party_masters`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| collection_code | text | NOT NULL |
| party_name | text | NOT NULL |
| c1_code | text | NOT NULL |
| c2_code | text | NOT NULL |
| status | text | default 'active' |

#### `barcode_store_masters`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| store_code | text | NOT NULL |
| store_name | text | NOT NULL |
| status | text | default 'active' |

---

### 1.8 System / Admin Tables

#### `audit_trails`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | text | |
| user_name | text | |
| user_email | text | |
| action | text | NOT NULL, CHECK IN ('create','update','delete','approve','reject','sync','login') |
| entity_type | text | NOT NULL |
| entity_id | text | |
| entity_name | text | |
| details | text | |
| old_values | jsonb | |
| new_values | jsonb | |

#### `role_permissions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| role | text | NOT NULL, CHECK IN ('ho','store_manager','accountant','admin') |
| department | text | NOT NULL, CHECK IN ('Design','Operations','Purchase','Sales','Marketing','HR') |
| field_name | text | NOT NULL |
| permission | text | NOT NULL, CHECK IN ('R','W','R/W','none') |

#### `marketplace_mappings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| marketplace | text | NOT NULL, CHECK IN ('shopify','amazon') |
| internal_sku | text | NOT NULL |
| internal_product_id | uuid | FK → products |
| marketplace_sku | text | NOT NULL |
| external_product_id | text | |
| status | text | default 'active', CHECK IN ('active','inactive','error') |
| last_sync_date | timestamptz | |
| error_message | text | |

#### `tally_sync_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| entity_type | text | NOT NULL, CHECK IN ('purchase','sale','payment','return','expense') |
| entity_id | text | NOT NULL |
| entity_number | text | |
| sync_status | text | NOT NULL, default 'pending', CHECK IN ('pending','success','failed','retry') |
| error_message | text | |
| last_sync_timestamp | timestamptz | |
| tally_reference_id | text | |
| retry_count | numeric | default 0 |
| payload | jsonb | |

---

## 2. Auth & Roles

### Users table (Supabase built-in `auth.users`)

Extra profile fields ke liye `profiles` table:

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'admin'
    CHECK IN ('admin','ho','store_manager','accountant','user'),
  department text CHECK IN ('head_office','store','warehouse','finance','admin','hr','operations'),
  store_id uuid REFERENCES stores(id),
  store_name text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Trigger: auto-create profile on signup
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Auth Pages to Migrate
- Login (email/password + Google OAuth)
- Register (email/password + OTP verification)
- ForgotPassword (email → reset link)
- ResetPassword (token + new password)

---

## 3. RLS Policies

### Current Base44 Setup
Sab entities pe **empty RLS** = all authenticated users have full CRUD.

### Supabase Equivalent (permissive — mirrors current setup)
```sql
-- Enable RLS on all 36 tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- Default policy: authenticated users have full access
CREATE POLICY "authenticated_full_access" ON stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON vendors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ... (repeat for all tables)
```

### Special: Transporters (admin-only delete — already in Base44)
```sql
CREATE POLICY "authenticated_read_transporters" ON transporters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_create_transporters" ON transporters
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_transporters" ON transporters
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "admin_delete_transporters" ON transporters
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

### Future Granular RLS Examples (jab roles restrict karne ho)
```sql
-- Store managers can only see their store's inventory
CREATE POLICY "store_manager_inventory_read" ON inventory
  FOR SELECT TO authenticated
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','ho')
  );

-- Only admin can delete vendors
CREATE POLICY "admin_delete_vendors" ON vendors
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

## 4. Backend Functions → Edge Functions

6 functions migrate karne padenge (Deno/TypeScript in Supabase):

| # | Base44 Function | Supabase Edge Function Path | External APIs Needed |
|---|----------------|---------------------------|---------------------|
| 1 | `barcodeEngine` | `supabase/functions/barcode-engine/` | None (pure logic) |
| 2 | `extractProductDetails` | `supabase/functions/extract-product/` | OpenAI/Anthropic/Gemini Vision API |
| 3 | `detectProductColor` | `supabase/functions/detect-color/` | Google Vision API ya LLM vision |
| 4 | `extractBillDetails` | `supabase/functions/extract-bill/` | OpenAI/Anthropic/Gemini Vision API |
| 5 | `syncMarketplaceOrders` | `supabase/functions/sync-marketplace/` | Shopify Admin API + Amazon SP-API |
| 6 | `tallySync` | `supabase/functions/tally-sync/` | Tally XML API (on-premise) |

### Extra API Keys Needed (Supabase Secrets)
- `OPENAI_API_KEY` ya `ANTHROPIC_API_KEY` (product/bill extraction)
- `GOOGLE_VISION_API_KEY` (color detection)
- `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` + `SHOPIFY_SHOP_URL`
- `AMAZON_SP_API_REFRESH_TOKEN` + `AMAZON_SP_API_SELLER_ID`
- `TALLY_API_URL`

### AI Integration Mapping
| Base44 Core Integration | Supabase Replacement |
|------------------------|---------------------|
| `InvokeLLM` | Direct OpenAI/Anthropic/Gemini API call from Edge Function |
| `GenerateImage` | OpenAI DALL-E / Stability AI API |
| `TranscribeAudio` | OpenAI Whisper API |
| `ExtractDataFromUploadedFile` | LLM with file input (vision model) |
| `UploadPublicFile` | Supabase Storage public bucket |
| `UploadPrivateFile` | Supabase Storage private bucket |
| `CreateFileSignedUrl` | Supabase `createSignedUrl()` |
| `SendEmail` | Resend / SendGrid / Supabase Auth email |
| `SendPushNotification` | Firebase Cloud Messaging / OneSignal |

---

## 5. File Storage

| Base44 | Supabase Equivalent |
|--------|-------------------|
| UploadPublicFile | Supabase Storage public bucket |
| UploadPrivateFile | Supabase Storage private bucket |
| CreateFileSignedUrl | Supabase `createSignedUrl()` |

### Storage Buckets
- `product-images` (public) — product catalog images
- `bill-uploads` (private) — purchase bills, expense receipts
- `receipts` (private) — sales receipts
- `repair-photos` (private) — repair job photos
- `rental-docs` (private) — rental agreements

---

## 6. Frontend Pages to Migrate

20 pages ka data layer rewrite (React + Tailwind rehta, sirf SDK calls change):

| # | Page | Route | Main Entities Used |
|---|------|-------|-------------------|
| 1 | Dashboard | `/` | Sale, PurchaseOrder, Inventory, Expense |
| 2 | Stores | `/stores` | Store |
| 3 | Vendors | `/vendors` | Vendor, VendorPricingRule, BarcodePartyMaster |
| 4 | PurchaseOrders | `/purchase-orders` | PurchaseOrder, Vendor, Store, Product, VendorPricingRule, PriceOverrideAudit |
| 5 | GoodsReceipt | `/goods-receipt` | GoodsReceipt, PurchaseOrder, Store |
| 6 | Cataloging | `/cataloging` | Product, Category, AttributeDefinition |
| 7 | Inventory | `/inventory` | Inventory, Store, Product |
| 8 | Allocations | `/allocations` | Allocation, Store, Product, Pallet |
| 9 | Pallets | `/pallets` | Pallet, Store, Shipment |
| 10 | AuditTrail | `/audit-trail` | AuditTrail |
| 11 | Settings | `/settings` | PaymentConfig, GstRegistration, Store |
| 12 | POS | `/pos` | Sale, Product, Inventory, Store, Customer |
| 13 | Returns | `/returns` | Return, Sale, Store, Customer |
| 14 | Rentals | `/rentals` | Rental, Customer, Store, Product |
| 15 | Repairs | `/repairs` | Repair, Customer, Product, Store |
| 16 | Ecommerce | `/ecommerce` | Order, Product, Store, MarketplaceMapping |
| 17 | Finance | `/finance` | Sale, Expense, Transaction, TallySyncLog |
| 18 | Assistant | `/assistant` | (AI agent — uses InvokeLLM) |
| 19 | BarcodeEngine | `/barcode-engine` | BarcodeRecord, BarcodeProductMaster, BarcodePartyMaster, BarcodeStoreMaster |
| 20 | Auth pages | `/login`, `/register`, `/forgot-password`, `/reset-password` | auth.users, profiles |

### SDK Call Mapping
| Base44 SDK | Supabase Client |
|-----------|---------------|
| `base44.entities.X.list()` | `supabase.from('x').select('*')` |
| `base44.entities.X.filter({field: val})` | `supabase.from('x').select('*').eq('field', val)` |
| `base44.entities.X.get(id)` | `supabase.from('x').select('*').eq('id', id).single()` |
| `base44.entities.X.create(data)` | `supabase.from('x').insert(data)` |
| `base44.entities.X.update(id, data)` | `supabase.from('x').update(data).eq('id', id)` |
| `base44.entities.X.delete(id)` | `supabase.from('x').delete().eq('id', id)` |
| `base44.entities.X.bulkCreate(arr)` | `supabase.from('x').insert(arr)` |
| `base44.entities.X.subscribe(cb)` | `supabase.channel('x').on('postgres_changes', ...)` |
| `base44.functions.invoke('fn', data)` | `fetch('/functions/v1/fn', {body: data})` |
| `base44.auth.me()` | `supabase.auth.getUser()` |
| `base44.auth.isAuthenticated()` | `supabase.auth.getSession()` |
| `base44.auth.logout()` | `supabase.auth.signOut()` |

---

## 7. Migration Order

### Phase 1: Foundation (1 week)
- Supabase project setup
- Auth configuration (email/password + Google OAuth)
- `profiles` table + trigger
- Storage buckets

### Phase 2: Core Tables (1 week)
- stores, vendors, customers, employees, transporters, gst_registrations
- products, categories, attribute_definitions
- calculation_rules

### Phase 3: Transactional Tables (1-2 weeks)
- purchase_orders, goods_receipts, vendor_pricing_rules, price_override_audits
- inventory, inventory_movements, allocations, pallets, shipments
- sales, orders, returns, rentals, repairs
- expenses, transactions, payment_configs

### Phase 4: System Tables (few days)
- audit_trails, role_permissions, marketplace_mappings, tally_sync_logs
- barcode_records, barcode_product_masters, barcode_party_masters, barcode_store_masters

### Phase 5: RLS Policies (few days)
- Start permissive (authenticated full access)
- Add admin-only delete policies
- Add store-scoped policies later

### Phase 6: Edge Functions (1-2 weeks)
- barcodeEngine (pure logic — easiest)
- extractProductDetails, extractBillDetails, detectProductColor (need LLM API keys)
- syncMarketplaceOrders (need Shopify/Amazon API)
- tallySync (need Tally on-premise connection)

### Phase 7: Frontend Data Layer (3-4 weeks)
- Create Supabase client utility
- Replace `base44.entities.X` calls in all 20 pages
- Replace `base44.functions.invoke` with fetch to edge functions
- Replace `base44.auth.*` with `supabase.auth.*`
- Update realtime subscriptions

### Phase 8: Data Migration Script (1 week)
- Export from Base44 via API
- Transform to Postgres format
- Insert into Supabase
- Verify counts and relations

### Phase 9: Testing & Cutover (1-2 weeks)
- End-to-end testing of all flows
- Parallel run (Base44 + Supabase) for verification
- Final cutover

### Total Estimated Time: 2-3 months focused work

---

## 8. Update Log

Jab bhi koi entity/field/function change ho, yahan entry add karo:

| Date | Change | Entity/Table | Details |
|------|--------|-------------|---------|
| 2026-09-17 | Initial creation | All | Complete migration reference document created with all 36 entities |

---

> **Note:** Yeh document living document hai. Jab bhi app mein koi change ho (naya entity, field add/remove, relation change, naya backend function), yahan update karte raho taaki migration ke time accurate reference mile.