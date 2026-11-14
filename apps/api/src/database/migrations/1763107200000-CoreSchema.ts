import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The full v1 schema from the technical blueprint: 13 tables and their enum types.
 * M1 uses users, addresses, collector_profiles, categories and daily_rates;
 * the pickup tables are created now and used from M2.
 */
export class CoreSchema1763107200000 implements MigrationInterface {
  name = 'CoreSchema1763107200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TYPE user_role AS ENUM ('HOUSEHOLD', 'COLLECTOR', 'ADMIN');
      CREATE TYPE user_status AS ENUM ('ACTIVE', 'FLAGGED', 'SUSPENDED');
      CREATE TYPE app_language AS ENUM ('BN', 'EN');
      CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      CREATE TYPE vehicle_type AS ENUM ('VAN', 'PUSHCART', 'ON_FOOT');
      CREATE TYPE pricing_type AS ENUM ('PER_KG', 'ON_INSPECTION');
      CREATE TYPE time_slot AS ENUM ('MORNING', 'MIDDAY', 'AFTERNOON');
      CREATE TYPE weight_band AS ENUM ('UNDER_5', 'FROM_5_TO_15', 'OVER_15', 'UNSURE');
      CREATE TYPE pickup_status AS ENUM (
        'REQUESTED', 'ACCEPTED', 'ARRIVED', 'WEIGHED', 'DISPUTED',
        'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'
      );
      CREATE TYPE payment_method AS ENUM ('CASH', 'BKASH', 'NAGAD');
      CREATE TYPE payment_status AS ENUM ('PAID', 'REPORTED', 'VERIFIED');
      CREATE TYPE dispute_type AS ENUM ('WEIGHT', 'PAYMENT', 'BEHAVIOUR', 'OTHER');
      CREATE TYPE dispute_status AS ENUM ('REWEIGH', 'ADMIN_REVIEW', 'RESOLVED');
      CREATE TYPE photo_kind AS ENUM ('ITEMS', 'SCALE');
    `);

    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        phone varchar(14) NOT NULL,
        role user_role NOT NULL,
        name varchar(80),
        language app_language NOT NULL DEFAULT 'BN',
        status user_status NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_phone_key UNIQUE (phone),
        CONSTRAINT users_phone_format CHECK (phone ~ '^\\+8801[3-9][0-9]{8}$')
      );

      CREATE TABLE addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label varchar(40) NOT NULL,
        line varchar(200) NOT NULL,
        area varchar(80) NOT NULL,
        city varchar(40) NOT NULL DEFAULT 'Dhaka',
        location geography(Point, 4326) NOT NULL,
        note varchar(200),
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX addresses_user_idx ON addresses (user_id);
      CREATE UNIQUE INDEX addresses_one_default_idx ON addresses (user_id) WHERE is_default;

      CREATE TABLE collector_profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        nid_number varchar(17) NOT NULL,
        nid_verified boolean NOT NULL DEFAULT false,
        selfie_url text,
        work_areas text[] NOT NULL DEFAULT '{}',
        vehicle_type vehicle_type NOT NULL,
        has_scale boolean NOT NULL DEFAULT false,
        verification_status verification_status NOT NULL DEFAULT 'PENDING',
        is_online boolean NOT NULL DEFAULT false,
        last_location geography(Point, 4326),
        last_seen_at timestamptz,
        rating_avg numeric(2, 1),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT collector_nid_format CHECK (nid_number ~ '^([0-9]{10}|[0-9]{13}|[0-9]{17})$')
      );
      CREATE INDEX collector_online_location_idx ON collector_profiles USING gist (last_location) WHERE is_online;
      CREATE INDEX collector_verification_idx ON collector_profiles (verification_status);

      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(30) NOT NULL,
        name_bn varchar(60) NOT NULL,
        name_en varchar(60) NOT NULL,
        pricing_type pricing_type NOT NULL,
        icon varchar(40) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL DEFAULT 0,
        CONSTRAINT categories_code_key UNIQUE (code)
      );

      CREATE TABLE daily_rates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL REFERENCES categories(id),
        effective_date date NOT NULL,
        rate_per_kg numeric(10, 2) NOT NULL CHECK (rate_per_kg > 0),
        published_by uuid REFERENCES users(id),
        published_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT daily_rates_category_date_key UNIQUE (category_id, effective_date)
      );
    `);

    await q.query(`
      CREATE SEQUENCE pickup_display_no_seq START 1001;

      CREATE TABLE pickups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        display_no bigint NOT NULL DEFAULT nextval('pickup_display_no_seq'),
        household_id uuid NOT NULL REFERENCES users(id),
        collector_id uuid REFERENCES users(id),
        address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
        address_text text NOT NULL,
        location geography(Point, 4326) NOT NULL,
        slot_date date NOT NULL,
        slot time_slot NOT NULL,
        weight_band weight_band NOT NULL,
        note varchar(200),
        status pickup_status NOT NULL DEFAULT 'REQUESTED',
        search_radius_m integer NOT NULL DEFAULT 1000,
        pickup_code_hash varchar(128),
        code_attempts smallint NOT NULL DEFAULT 0,
        payment_method payment_method,
        total_kg numeric(8, 1),
        total_amount numeric(12, 2),
        requested_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        arrived_at timestamptz,
        weighed_at timestamptz,
        confirmed_at timestamptz,
        completed_at timestamptz,
        cancelled_at timestamptz,
        expires_at timestamptz NOT NULL,
        CONSTRAINT pickups_display_no_key UNIQUE (display_no),
        CONSTRAINT pickups_collector_after_accept CHECK (
          status IN ('REQUESTED', 'CANCELLED', 'EXPIRED') OR collector_id IS NOT NULL
        )
      );
      ALTER SEQUENCE pickup_display_no_seq OWNED BY pickups.display_no;
      CREATE INDEX pickups_open_location_idx ON pickups USING gist (location) WHERE status = 'REQUESTED';
      CREATE INDEX pickups_collector_status_idx ON pickups (collector_id, status);
      CREATE INDEX pickups_household_recent_idx ON pickups (household_id, requested_at DESC);

      CREATE TABLE pickup_items (
        pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
        category_id uuid NOT NULL REFERENCES categories(id),
        rate_snapshot numeric(10, 2),
        PRIMARY KEY (pickup_id, category_id)
      );

      CREATE TABLE weigh_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
        category_id uuid NOT NULL REFERENCES categories(id),
        version smallint NOT NULL,
        kg numeric(8, 1) NOT NULL CHECK (kg > 0),
        rate numeric(10, 2),
        amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT weigh_lines_round_key UNIQUE (pickup_id, version, category_id)
      );

      CREATE TABLE pickup_photos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
        kind photo_kind NOT NULL,
        weigh_version smallint,
        storage_key text NOT NULL,
        uploaded_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX pickup_photos_pickup_idx ON pickup_photos (pickup_id);

      CREATE TABLE payments (
        pickup_id uuid PRIMARY KEY REFERENCES pickups(id) ON DELETE CASCADE,
        method payment_method NOT NULL,
        amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
        wallet_number varchar(14),
        trx_id varchar(30),
        status payment_status NOT NULL DEFAULT 'PAID',
        paid_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT payments_trx_required CHECK (method = 'CASH' OR trx_id IS NOT NULL),
        CONSTRAINT payments_trx_once UNIQUE (method, trx_id)
      );

      CREATE TABLE disputes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
        raised_by uuid NOT NULL REFERENCES users(id),
        type dispute_type NOT NULL,
        status dispute_status NOT NULL,
        reason text,
        resolution varchar(30),
        resolution_note text,
        resolved_by uuid REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz
      );
      CREATE INDEX disputes_status_idx ON disputes (status, created_at);

      CREATE TABLE ratings (
        pickup_id uuid PRIMARY KEY REFERENCES pickups(id) ON DELETE CASCADE,
        stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
        comment varchar(300),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE status_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
        from_status pickup_status,
        to_status pickup_status NOT NULL,
        actor_id uuid REFERENCES users(id),
        actor_role user_role,
        meta jsonb,
        at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX status_events_pickup_idx ON status_events (pickup_id, at);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE status_events, ratings, disputes, payments, pickup_photos, weigh_lines,
        pickup_items, pickups, daily_rates, categories, collector_profiles, addresses, users;
      DROP TYPE photo_kind, dispute_status, dispute_type, payment_status, payment_method,
        pickup_status, weight_band, time_slot, pricing_type, vehicle_type,
        verification_status, app_language, user_status, user_role;
    `);
  }
}
