import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'pos-database.db')

  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Run migrations
  runMigrations()

  console.log(`[DB] SQLite initialized at: ${dbPath}`)
}

function runMigrations() {
  const migrations = [
    migration_001_initial_schema,
    migration_002_seed_data,
  ]

  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  const applied = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  const appliedNames = new Set(applied.map((r) => r.name))

  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      console.log(`[DB] Applying migration: ${migration.name}`)
      db.exec(migration.sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
    }
  }
}

const migration_001_initial_schema = {
  name: '001_initial_schema',
  sql: `
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#4F46E5',
      icon TEXT DEFAULT 'utensils',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT,
      base_price REAL NOT NULL DEFAULT 0,
      image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
    );

    -- Variants (Size: Small/Med/Large etc.)
    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_modifier REAL NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    -- Addon Groups (e.g. "Extra Toppings", "Cooking Preference")
    CREATE TABLE IF NOT EXISTS addon_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      min_select INTEGER DEFAULT 0,
      max_select INTEGER DEFAULT 1,
      is_required INTEGER DEFAULT 0
    );

    -- Addons (items within an addon group)
    CREATE TABLE IF NOT EXISTS addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      addon_group_id INTEGER NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0
    );

    -- Combos
    CREATE TABLE IF NOT EXISTS combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS combo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1
    );

    -- Tables / Sections
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      section TEXT DEFAULT 'Main',
      capacity INTEGER DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available',
      current_order_id INTEGER,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Users / Staff
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'cashier',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      table_id INTEGER REFERENCES tables(id),
      type TEXT NOT NULL DEFAULT 'dine_in',
      status TEXT NOT NULL DEFAULT 'pending',
      cashier_id INTEGER REFERENCES users(id),
      waiter_id INTEGER REFERENCES users(id),
      customer_name TEXT,
      customer_count INTEGER DEFAULT 1,
      notes TEXT,
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_type TEXT,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      synced_at TEXT
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      combo_id INTEGER REFERENCES combos(id),
      variant_id INTEGER REFERENCES variants(id),
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Order Item Addons
    CREATE TABLE IF NOT EXISTS order_item_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      addon_id INTEGER REFERENCES addons(id),
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0
    );

    -- Order Modifiers (discounts, vouchers)
    CREATE TABLE IF NOT EXISTS order_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      is_percentage INTEGER DEFAULT 0
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      method TEXT NOT NULL DEFAULT 'cash',
      amount REAL NOT NULL DEFAULT 0,
      tendered REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      reference_no TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
    );

    -- Vouchers / Promo Codes
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      min_order_amount REAL DEFAULT 0,
      usage_limit INTEGER DEFAULT NULL,
      usage_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Sync Queue
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT,
      error TEXT
    );

    -- App Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `,
}

const migration_002_seed_data = {
  name: '002_seed_data',
  sql: `
    -- Default admin user (PIN: 0000)
    INSERT OR IGNORE INTO users (name, pin, role) VALUES ('Admin', '0000', 'owner');
    INSERT OR IGNORE INTO users (name, pin, role) VALUES ('Manager', '1111', 'manager');
    INSERT OR IGNORE INTO users (name, pin, role) VALUES ('Cashier 1', '2222', 'cashier');
    INSERT OR IGNORE INTO users (name, pin, role) VALUES ('Kitchen Staff', '3333', 'kitchen');

    -- Default categories
    INSERT OR IGNORE INTO categories (name, color, icon, sort_order) VALUES ('Mains', '#4F46E5', 'utensils', 1);
    INSERT OR IGNORE INTO categories (name, color, icon, sort_order) VALUES ('Drinks', '#0EA5E9', 'coffee', 2);
    INSERT OR IGNORE INTO categories (name, color, icon, sort_order) VALUES ('Desserts', '#EC4899', 'cake', 3);
    INSERT OR IGNORE INTO categories (name, color, icon, sort_order) VALUES ('Add-ons', '#F59E0B', 'plus-circle', 4);

    -- Default tables
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 1', 'Main', 4);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 2', 'Main', 4);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 3', 'Main', 6);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 4', 'Main', 2);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 5', 'VIP', 8);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Table 6', 'VIP', 8);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Bar 1', 'Bar', 2);
    INSERT OR IGNORE INTO tables (name, section, capacity) VALUES ('Bar 2', 'Bar', 2);

    -- Sample menu items
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (1, 'Classic Burger', 'Beef patty with lettuce, tomato, and cheese', 185, 1);
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (1, 'Grilled Chicken', 'Herb-marinated grilled chicken with sides', 220, 2);
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (1, 'Pasta Carbonara', 'Creamy carbonara with bacon and parmesan', 195, 3);
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (2, 'Iced Coffee', 'Cold brew over ice with milk', 120, 1);
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (2, 'Fresh Lemonade', 'Freshly squeezed lemonade with mint', 95, 2);
    INSERT OR IGNORE INTO products (category_id, name, description, base_price, sort_order) 
    VALUES (3, 'Chocolate Lava Cake', 'Warm lava cake with vanilla ice cream', 145, 1);

    -- Settings
    INSERT OR IGNORE INTO settings (key, value) VALUES ('restaurant_name', 'My Restaurant');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('currency_symbol', '₱');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '12');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled', 'false');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'Thank you for dining with us!');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('sc_pwd_discount', '20');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('order_number_prefix', 'ORD');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('order_number_counter', '1');
  `,
}
