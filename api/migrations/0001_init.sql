CREATE TABLE rounds (
  id INTEGER PRIMARY KEY,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  close_block INTEGER,
  close_balance TEXT,
  fees TEXT,
  eth_usd REAL,
  prize TEXT,
  winner_entry_id INTEGER,
  judge_note TEXT,
  claim_status TEXT,
  claim_deadline INTEGER,
  claim_wallet TEXT,
  claimed_at INTEGER,
  closed_at INTEGER,
  judged_at INTEGER,
  settled_at INTEGER
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds (id),
  title TEXT NOT NULL,
  name TEXT NOT NULL,
  image_key TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (round_id, source)
);

CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL UNIQUE REFERENCES rounds (id),
  recipient TEXT NOT NULL,
  amount TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  raw_tx TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  block INTEGER,
  sent_at INTEGER NOT NULL
);

CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX rounds_status ON rounds (status, id);
CREATE INDEX rounds_claims ON rounds (claim_status, id);
CREATE INDEX entries_round ON entries (round_id, hidden);
CREATE INDEX payouts_status ON payouts (status);
CREATE INDEX prompts_status ON prompts (status, id);
CREATE INDEX prompts_source ON prompts (source, created_at);
