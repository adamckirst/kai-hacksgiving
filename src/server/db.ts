import {registerSearch} from './search';
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

export function openDatabase(path:string|Buffer = ':memory:') {
  const db = new Database(path);
  registerSearch(db);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id),
      kind TEXT NOT NULL CHECK(kind IN ('judge','public')), mcp_token TEXT UNIQUE,
      upload_token TEXT UNIQUE, created_at TEXT NOT NULL, CHECK(workspace_id = id)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      title TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('recording','shared','paste','sample')),
      text TEXT NOT NULL, happened_on TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('waiting','listening','reading','ready','failed')), error TEXT,
      UNIQUE(workspace_id,id)
    );
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL, UNIQUE(workspace_id,id)
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), conversation_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('person','note','todo','done')), payload TEXT NOT NULL CHECK(json_valid(payload)),
      quote TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','accepted','rejected')),
      FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id)
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), person_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL, text TEXT NOT NULL, quote TEXT NOT NULL,
      FOREIGN KEY(workspace_id,person_id) REFERENCES people(workspace_id,id),
      FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id)
    );
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), text TEXT NOT NULL,
      owner_person_id TEXT, due_on TEXT, status TEXT NOT NULL CHECK(status IN ('open','done')), quote TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      FOREIGN KEY(workspace_id,owner_person_id) REFERENCES people(workspace_id,id),
      FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id)
    );
    CREATE TABLE IF NOT EXISTS recording_emails (
      id TEXT PRIMARY KEY REFERENCES conversations(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      counts TEXT NOT NULL CHECK(json_valid(counts)), queued_at INTEGER NOT NULL,
      first_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
      sent_at INTEGER, closed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notification_sends (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), sent_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trial_challenges (email TEXT PRIMARY KEY,id TEXT NOT NULL,ip_hash TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL,delivered INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trial_sends (id TEXT PRIMARY KEY,ip_hash TEXT NOT NULL,email_hash TEXT NOT NULL,sent_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS quota_emails (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), fingerprint TEXT NOT NULL,
      requested_seconds INTEGER NOT NULL, remaining_seconds INTEGER NOT NULL, queued_at INTEGER NOT NULL,
      first_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
      sent_at INTEGER, closed INTEGER NOT NULL DEFAULT 0, UNIQUE(workspace_id,fingerprint)
    );
    CREATE TABLE IF NOT EXISTS login_challenges (
      email TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), id TEXT NOT NULL,
      code_hash TEXT NOT NULL, browser_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, delivered INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS entry_challenges (
      email TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, ip_hash TEXT NOT NULL,
      browser_hash TEXT NOT NULL UNIQUE, origin_workspace TEXT NOT NULL REFERENCES workspaces(id),
      code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      delivered INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS browser_sessions (
      digest TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deleted_trial_grants (email_hash TEXT PRIMARY KEY, ip_hash TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS deleted_usage (day TEXT PRIMARY KEY, readings INTEGER NOT NULL DEFAULT 0, recordings INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS deleted_audio (path TEXT PRIMARY KEY);
  `);
  db.transaction(()=> {
  if(!(db.prepare('PRAGMA table_info(recording_emails)').all() as {name:string}[]).some(c=>c.name==='title'))db.exec("ALTER TABLE recording_emails ADD COLUMN title TEXT NOT NULL DEFAULT 'Your recording'");
  if(!(db.prepare('PRAGMA table_info(recording_emails)').all() as {name:string}[]).some(c=>c.name==='kind'))db.exec(`
    CREATE TABLE recording_emails_next (
      id TEXT NOT NULL REFERENCES conversations(id), kind TEXT NOT NULL CHECK(kind IN ('ready','failed')),
      workspace_id TEXT NOT NULL REFERENCES workspaces(id), counts TEXT NOT NULL CHECK(json_valid(counts)),
      queued_at INTEGER NOT NULL, first_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0, sent_at INTEGER, closed INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT 'Your recording', PRIMARY KEY(id,kind)
    );
    INSERT INTO recording_emails_next SELECT id,'ready',workspace_id,counts,queued_at,first_attempt_at,attempts,next_attempt_at,sent_at,closed,title FROM recording_emails;
    DROP TABLE recording_emails;
    ALTER TABLE recording_emails_next RENAME TO recording_emails;
  `);
  const columns=db.prepare('PRAGMA table_info(workspaces)').all() as {name:string}[];
  if(!columns.some(c=>c.name==='waitlist_visitors'))db.exec("ALTER TABLE workspaces ADD COLUMN waitlist_visitors TEXT NOT NULL DEFAULT '{}'");
  if(!columns.some(c=>c.name==='session_secret')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN session_secret TEXT');
    // Preserve existing browser cookies, but never expose their signing secret
    // as the new sharing address. Earlier steps had not exposed upload addresses.
    const judges=db.prepare("SELECT id,upload_token FROM workspaces WHERE kind='judge'").all() as {id:string;upload_token:string|null}[];
    for(const judge of judges) {
      if(judge.upload_token) db.prepare('UPDATE workspaces SET session_secret=?,upload_token=? WHERE id=?').run(judge.upload_token,randomBytes(32).toString('hex'),judge.id);
    }
  }
  if (!columns.some(c=>c.name==='reading_day')) db.exec("ALTER TABLE workspaces ADD COLUMN reading_day TEXT; ALTER TABLE workspaces ADD COLUMN readings_today INTEGER NOT NULL DEFAULT 0;");
  if (!columns.some(c=>c.name==='recording_day')) db.exec("ALTER TABLE workspaces ADD COLUMN recording_day TEXT; ALTER TABLE workspaces ADD COLUMN recordings_today INTEGER NOT NULL DEFAULT 0;");
  if(!columns.some(c=>c.name==='trial_seconds')) db.exec('ALTER TABLE workspaces ADD COLUMN trial_seconds INTEGER');
  if(!columns.some(c=>c.name==='trial_allowance'))db.exec('ALTER TABLE workspaces ADD COLUMN trial_allowance INTEGER NOT NULL DEFAULT 1800; UPDATE workspaces SET trial_seconds=max(0,trial_seconds-1800) WHERE trial_seconds IS NOT NULL');
  const waitlist=db.prepare('PRAGMA table_info(waitlist)').all() as {name:string}[];
  if(!waitlist.some(c=>c.name==='terms_version'))db.exec('ALTER TABLE waitlist ADD COLUMN terms_version TEXT; ALTER TABLE waitlist ADD COLUMN terms_accepted_at TEXT');
  if(!waitlist.some(c=>c.name==='workspace_id')) db.exec('ALTER TABLE waitlist ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)');
  if(!columns.some(c=>c.name==='shortcut_ready'))db.exec("ALTER TABLE workspaces ADD COLUMN shortcut_ready INTEGER NOT NULL DEFAULT 0; UPDATE workspaces SET shortcut_ready=1 WHERE EXISTS (SELECT 1 FROM conversations c WHERE c.workspace_id=workspaces.id AND c.source='shared')");
  if(!columns.some(c=>c.name==='trial_ended'))db.exec('ALTER TABLE workspaces ADD COLUMN trial_ended INTEGER NOT NULL DEFAULT 0');
  if(!columns.some(c=>c.name==='trial_verified'))db.exec('ALTER TABLE workspaces ADD COLUMN trial_verified INTEGER NOT NULL DEFAULT 0');
  if(!waitlist.some(c=>c.name==='verified_at'))db.exec('ALTER TABLE waitlist ADD COLUMN verified_at TEXT; ALTER TABLE waitlist ADD COLUMN trial_ip TEXT; CREATE UNIQUE INDEX waitlist_trial_ip ON waitlist(trial_ip) WHERE trial_ip IS NOT NULL');
  const conversations=db.prepare('PRAGMA table_info(conversations)').all() as {name:string}[];
  if(!conversations.some(c=>c.name==='audio_path')) db.exec("ALTER TABLE conversations ADD COLUMN audio_path TEXT; ALTER TABLE conversations ADD COLUMN happened_at INTEGER NOT NULL DEFAULT 0; ALTER TABLE conversations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0; ALTER TABLE conversations ADD COLUMN transcribed INTEGER NOT NULL DEFAULT 0;");
  if(!conversations.some(c=>c.name==='recording_type'))db.exec("ALTER TABLE conversations ADD COLUMN recording_type TEXT; ALTER TABLE conversations ADD COLUMN utterances TEXT NOT NULL DEFAULT '[]'; ALTER TABLE conversations ADD COLUMN speaker_map TEXT NOT NULL DEFAULT '{}'; ALTER TABLE conversations ADD COLUMN awaiting_speakers INTEGER NOT NULL DEFAULT 0");
  if(!conversations.some(c=>c.name==='batch_id')) db.exec('ALTER TABLE conversations ADD COLUMN batch_id TEXT');
  if(!conversations.some(c=>c.name==='notification_seen_status'))db.exec('ALTER TABLE conversations ADD COLUMN notification_seen_status TEXT');
  if(!conversations.some(c=>c.name==='failure_code'))db.exec("ALTER TABLE conversations ADD COLUMN failure_code TEXT; ALTER TABLE conversations ADD COLUMN tool_error_counts TEXT NOT NULL DEFAULT '{}'");
  if(!conversations.some(c=>c.name==='notify_ready'))db.exec('ALTER TABLE conversations ADD COLUMN notify_ready INTEGER NOT NULL DEFAULT 0');
  if(!conversations.some(c=>c.name==='reserved_seconds'))db.exec('ALTER TABLE conversations ADD COLUMN reserved_seconds INTEGER');
  if(!conversations.some(c=>c.name==='reserved_on')) db.exec('ALTER TABLE conversations ADD COLUMN reserved_on TEXT');
  if(!conversations.some(c=>c.name==='awaiting_person')) db.exec('ALTER TABLE conversations ADD COLUMN awaiting_person INTEGER NOT NULL DEFAULT 0');
  if(!conversations.some(c=>c.name==='person_id')) db.exec('ALTER TABLE conversations ADD COLUMN person_id TEXT REFERENCES people(id)');
  if(!conversations.some(c=>c.name==='progress')) db.exec('ALTER TABLE conversations ADD COLUMN progress TEXT');
  const todos=db.prepare('PRAGMA table_info(todos)').all() as {name:string}[];
  if(!todos.some(c=>c.name==='person_id')) {
    db.exec('ALTER TABLE todos ADD COLUMN person_id TEXT REFERENCES people(id)');
  }
  // Older deployed steps can seed a new copy after this column already exists.
  // Fill only missing links on the two known seed rows; preserve all user decisions.
  db.exec("UPDATE todos SET person_id=CASE WHEN workspace_id='public' THEN 'dana' ELSE workspace_id||':dana' END WHERE person_id IS NULL AND id=CASE WHEN workspace_id='public' THEN 'pricing' ELSE workspace_id||':pricing' END; UPDATE todos SET person_id=owner_person_id WHERE person_id IS NULL AND id=CASE WHEN workspace_id='public' THEN 'trial' ELSE workspace_id||':trial' END;");
  })();
  return db;
}
export type KaiDatabase = ReturnType<typeof openDatabase>;
export function seed(db: KaiDatabase, now = new Date(), workspace = 'public', populated = true) {
  const id = (name: string) => workspace === 'public' ? name : `${workspace}:${name}`;
  const day = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0,10);
  db.transaction(() => {
    if (db.prepare('SELECT id FROM workspaces WHERE id = ?').get(workspace)) return;
    db.prepare('INSERT INTO workspaces (id,workspace_id,kind,mcp_token,upload_token,created_at,session_secret) VALUES (?, ?, ?, ?, ?, ?, ?)').run(workspace, workspace, workspace === 'public' ? 'public' : 'judge', workspace === 'public' ? null : randomBytes(32).toString('hex'), workspace === 'public' ? null : randomBytes(32).toString('hex'), now.toISOString(),workspace === 'public' ? null : randomBytes(32).toString('hex'));
    if(!populated)return;
    const person = db.prepare('INSERT INTO people VALUES (?, ?, ?, ?, ?)');
    person.run(id('dana'),workspace,'Dana Whitfield','Willow Dental','Operations lead');
    person.run(id('ellis'),workspace,'Ellis Rowan','Harbour Dental','Clinic owner');
    person.run(id('nia'),workspace,'Nia Calder','Loomwork','Product lead');
    const conversation = db.prepare('INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status,error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)');
    conversation.run(id('dana-call'),workspace,'First call with Dana','Dana wants pricing for three clinics.\nHer team needs simpler scheduling.','paste','Dana Whitfield at Willow Dental wants pricing for three clinics. I promised to send Dana the pricing. She wants fewer gaps between appointments.',day(-4),'ready');
    conversation.run(id('ellis-call'),workspace,'A trial with Ellis','Ellis will ask the team about a trial.\nWe will talk again next week.','paste','Ellis Rowan at Harbour Dental will ask the team about a trial. Ellis promised to send the trial dates.',day(-2),'ready');
    db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)').run(id('dana-note'),workspace,id('dana'),id('dana-call'),'Wants fewer gaps between appointments.','She wants fewer gaps between appointments.');
    const todo = db.prepare('INSERT INTO todos (id,workspace_id,text,owner_person_id,due_on,status,quote,conversation_id,person_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    todo.run(id('pricing'),workspace,'Send Dana the pricing',null,day(-2),'open','I promised to send Dana the pricing.',id('dana-call'),id('dana'));
    todo.run(id('trial'),workspace,'Send the trial dates',id('ellis'),day(2),'open','Ellis promised to send the trial dates.',id('ellis-call'),id('ellis'));
  })();
}
