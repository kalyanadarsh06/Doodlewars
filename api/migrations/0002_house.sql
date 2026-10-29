ALTER TABLE finals ADD COLUMN house TEXT NOT NULL DEFAULT '0';
ALTER TABLE finals ADD COLUMN house_status TEXT;

DROP INDEX payouts_status;
DROP TABLE payouts;

CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  final_id INTEGER NOT NULL REFERENCES finals (id),
  kind TEXT NOT NULL DEFAULT 'prize',
  recipient TEXT NOT NULL,
  amount TEXT NOT NULL,
  gas TEXT,
  nonce INTEGER NOT NULL,
  raw_tx TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  block INTEGER,
  sent_at INTEGER NOT NULL,
  UNIQUE (final_id, kind)
);

CREATE INDEX payouts_status ON payouts (status);
CREATE INDEX finals_house ON finals (house_status, id);
