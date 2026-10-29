CREATE TABLE rounds (
  id INTEGER PRIMARY KEY,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  winner_entry_id INTEGER,
  judge_note TEXT,
  closed_at INTEGER,
  judged_at INTEGER
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds (id),
  title TEXT NOT NULL,
  wallet TEXT,
  entered INTEGER NOT NULL DEFAULT 0,
  image_key TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (round_id, source),
  UNIQUE (round_id, wallet)
);

CREATE TABLE finals (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'closed',
  close_block INTEGER NOT NULL,
  close_balance TEXT NOT NULL,
  fees TEXT NOT NULL,
  carry TEXT,
  prize TEXT,
  winner_entry_id INTEGER REFERENCES entries (id),
  judge_note TEXT,
  pay_status TEXT,
  closed_at INTEGER NOT NULL,
  settled_at INTEGER
);

CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  final_id INTEGER NOT NULL UNIQUE REFERENCES finals (id),
  recipient TEXT NOT NULL,
  amount TEXT NOT NULL,
  gas TEXT,
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
CREATE INDEX entries_round ON entries (round_id, hidden);
CREATE INDEX finals_status ON finals (status, id);
CREATE INDEX finals_pay ON finals (pay_status, id);
CREATE INDEX payouts_status ON payouts (status);
CREATE INDEX prompts_status ON prompts (status, id);
CREATE INDEX prompts_source ON prompts (source, created_at);
