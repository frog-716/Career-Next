export const interviewMigration=`CREATE TABLE interview_sessions(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('real','simulation')),real_round_id TEXT REFERENCES interview_sessions(id),revision INTEGER NOT NULL,body TEXT NOT NULL,CHECK((kind='real' AND real_round_id IS NULL) OR (kind='simulation' AND real_round_id IS NOT NULL)));
CREATE INDEX interview_opportunity ON interview_sessions(opportunity_id);
CREATE TABLE interview_history(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES interview_sessions(id),body TEXT NOT NULL);`;
