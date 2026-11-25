import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

export function openDatabase(path = ':memory:') {
  const db = new Database(path);
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
    CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, created_at TEXT NOT NULL);
  `);
  db.transaction(()=> {
  const columns=db.prepare('PRAGMA table_info(workspaces)').all() as {name:string}[];
  if (!columns.some(c=>c.name==='reading_day')) db.exec("ALTER TABLE workspaces ADD COLUMN reading_day TEXT; ALTER TABLE workspaces ADD COLUMN readings_today INTEGER NOT NULL DEFAULT 0;");
  if (!columns.some(c=>c.name==='recording_day')) db.exec("ALTER TABLE workspaces ADD COLUMN recording_day TEXT; ALTER TABLE workspaces ADD COLUMN recordings_today INTEGER NOT NULL DEFAULT 0;");
  const conversations=db.prepare('PRAGMA table_info(conversations)').all() as {name:string}[];
  if(!conversations.some(c=>c.name==='audio_path')) db.exec("ALTER TABLE conversations ADD COLUMN audio_path TEXT; ALTER TABLE conversations ADD COLUMN happened_at INTEGER NOT NULL DEFAULT 0; ALTER TABLE conversations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0; ALTER TABLE conversations ADD COLUMN transcribed INTEGER NOT NULL DEFAULT 0;");
  if(!conversations.some(c=>c.name==='batch_id')) db.exec('ALTER TABLE conversations ADD COLUMN batch_id TEXT');
  })();
  return db;
}
export type KaiDatabase = ReturnType<typeof openDatabase>;
export function seed(db: KaiDatabase, now = new Date(), workspace = 'public') {
  const id = (name: string) => workspace === 'public' ? name : `${workspace}:${name}`;
  const day = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0,10);
  db.transaction(() => {
    if (db.prepare('SELECT id FROM workspaces WHERE id = ?').get(workspace)) return;
    db.prepare('INSERT INTO workspaces (id,workspace_id,kind,mcp_token,upload_token,created_at) VALUES (?, ?, ?, ?, ?, ?)').run(workspace, workspace, workspace === 'public' ? 'public' : 'judge', workspace === 'public' ? null : randomBytes(32).toString('hex'), workspace === 'public' ? null : randomBytes(32).toString('hex'), now.toISOString());
    const person = db.prepare('INSERT INTO people VALUES (?, ?, ?, ?, ?)');
    person.run(id('dana'),workspace,'Dana Whitfield','Willow Dental','Operations lead');
    person.run(id('ellis'),workspace,'Ellis Rowan','Harbour Dental','Clinic owner');
    person.run(id('nia'),workspace,'Nia Calder','Loomwork','Product lead');
    const conversation = db.prepare('INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status,error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)');
    conversation.run(id('dana-call'),workspace,'First call with Dana','Dana wants pricing for three clinics.\nHer team needs simpler scheduling.','paste','Dana Whitfield at Willow Dental wants pricing for three clinics. I promised to send Dana the pricing. She wants fewer gaps between appointments.',day(-4),'ready');
    conversation.run(id('ellis-call'),workspace,'A trial with Ellis','Ellis will ask the team about a trial.\nWe will talk again next week.','paste','Ellis Rowan at Harbour Dental will ask the team about a trial. Ellis promised to send the trial dates.',day(-2),'ready');
    db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)').run(id('dana-note'),workspace,id('dana'),id('dana-call'),'Wants fewer gaps between appointments.','She wants fewer gaps between appointments.');
    const todo = db.prepare('INSERT INTO todos VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    todo.run(id('pricing'),workspace,'Send Dana the pricing',null,day(-2),'open','I promised to send Dana the pricing.',id('dana-call'));
    todo.run(id('trial'),workspace,'Send the trial dates',id('ellis'),day(2),'open','Ellis promised to send the trial dates.',id('ellis-call'));
  })();
}
