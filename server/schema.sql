-- Planetour CRM PostgreSQL schema. This file is intentionally idempotent so it
-- can be executed safely during startup and by `npm run db:init`.

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'COUNTER', 'FINANCE', 'READONLY')),
    role_label VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    department VARCHAR(100),
    avatar_color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gds_systems (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('AGENCY', 'GOVERNMENT', 'CORPORATE')),
    nit VARCHAR(50) NOT NULL,
    iata_code VARCHAR(50),
    tier VARCHAR(50) NOT NULL DEFAULT 'GOLD' CHECK (tier IN ('GOLD', 'SILVER', 'BRONZE', 'ESTATAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WARNING', 'BLOCKED', 'INACTIVE')),
    city VARCHAR(100),
    address VARCHAR(255),
    phone VARCHAR(50),
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    karing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (karing_balance >= 0),
    overdue_days INTEGER NOT NULL DEFAULT 0 CHECK (overdue_days >= 0),
    owner_json JSONB,
    accounts_payable_json JSONB,
    operational_counter_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signatures (
    id VARCHAR(50) PRIMARY KEY,
    pcc VARCHAR(50) NOT NULL,
    system_id VARCHAR(50) NOT NULL REFERENCES gds_systems(id) ON DELETE CASCADE,
    client_id VARCHAR(50) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_name VARCHAR(150) NOT NULL,
    agent_sign VARCHAR(50),
    duty_code VARCHAR(20) NOT NULL DEFAULT 'SU',
    permissions VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED_OVERDUE', 'INACTIVE')),
    issued_month_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (issued_month_amount >= 0),
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_contracts (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contract_number VARCHAR(100) NOT NULL,
    secop_url TEXT,
    object TEXT NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    executed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (executed_amount >= 0),
    pending_billing NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (pending_billing >= 0),
    start_date DATE,
    end_date DATE,
    stage VARCHAR(50) NOT NULL DEFAULT 'EN_EJECUCION',
    insurance_policy_status VARCHAR(50) NOT NULL DEFAULT 'VIGENTE',
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    milestone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS karing_ledger (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (due_date >= issue_date)
);

CREATE TABLE IF NOT EXISTS hotel_inventory (
    id VARCHAR(50) PRIMARY KEY,
    room_type VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    rack_rate NUMERIC(12, 2) NOT NULL CHECK (rack_rate >= 0),
    b2b_agency_rate NUMERIC(12, 2) NOT NULL CHECK (b2b_agency_rate >= 0),
    capacity VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    current_guest_or_agency VARCHAR(200) NOT NULL DEFAULT '-'
);

CREATE TABLE IF NOT EXISTS reserve_packages (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    public_price NUMERIC(12, 2) NOT NULL CHECK (public_price >= 0),
    b2b_price NUMERIC(12, 2) NOT NULL CHECK (b2b_price >= 0),
    includes TEXT,
    daily_capacity_limit INTEGER NOT NULL DEFAULT 50 CHECK (daily_capacity_limit >= 0),
    current_booked_today INTEGER NOT NULL DEFAULT 0 CHECK (current_booked_today >= 0)
);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutable normalization helper used by the public agency lookup. Keeping the
-- normalization in PostgreSQL makes matching consistent across ordinary columns,
-- JSON contact fields and related GDS records without requiring an extension.
CREATE OR REPLACE FUNCTION planetour_normalize_search(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT regexp_replace(
        translate(
            LOWER(COALESCE(value, '')),
            'áàäâãåéèëêíìïîóòöôõúùüûñç',
            'aaaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        '',
        'g'
    )
$$;

-- Case-insensitive business identifiers prevent duplicate records that differ
-- only by letter case. Foreign-key and sort indexes cover the most common CRM
-- list/dashboard queries and avoid full table scans as data grows.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS gds_systems_code_upper_uidx ON gds_systems (UPPER(code));
CREATE INDEX IF NOT EXISTS gds_systems_name_idx ON gds_systems (name, id);

CREATE UNIQUE INDEX IF NOT EXISTS clients_nit_lower_uidx ON clients (LOWER(nit));
CREATE INDEX IF NOT EXISTS clients_created_at_idx ON clients (created_at DESC, id);
CREATE INDEX IF NOT EXISTS clients_status_type_idx ON clients (status, type);

CREATE INDEX IF NOT EXISTS signatures_created_at_idx ON signatures (created_at DESC, id);
CREATE INDEX IF NOT EXISTS signatures_client_idx ON signatures (client_id, status);
CREATE INDEX IF NOT EXISTS signatures_system_idx ON signatures (system_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS public_contracts_number_lower_uidx
    ON public_contracts (LOWER(contract_number));
CREATE INDEX IF NOT EXISTS public_contracts_client_idx ON public_contracts (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS public_contracts_stage_dates_idx ON public_contracts (stage, end_date);

CREATE UNIQUE INDEX IF NOT EXISTS karing_ledger_invoice_lower_uidx
    ON karing_ledger (LOWER(invoice_number));
CREATE INDEX IF NOT EXISTS karing_ledger_client_status_idx
    ON karing_ledger (client_id, status, due_date);
CREATE INDEX IF NOT EXISTS karing_ledger_due_date_idx ON karing_ledger (due_date, status);
