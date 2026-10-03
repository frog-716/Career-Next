export const offerMigration=`CREATE TABLE opportunity_offer (
 id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL, body_json TEXT NOT NULL);
CREATE TABLE opportunity_offer_history (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES opportunity_offer(id), event_json TEXT NOT NULL);
CREATE TABLE opportunity_offer_acceptance (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES opportunity_offer(id), basis_json TEXT NOT NULL);`;
