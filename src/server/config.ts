import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { KaiDatabase } from './db';
export function databasePath(env:NodeJS.ProcessEnv) {
  const file=env.KAI_DB ?? ':memory:';
  if (env.NODE_ENV === 'production') {
    const relative=path.relative(process.cwd(),path.resolve(file));
    if (file === ':memory:' || !path.isAbsolute(file) || (!relative.startsWith('../') && relative !== '..')) throw new Error('Production requires KAI_DB outside the code folder.');
  }
  return file;
}
// The public workspace never has an MCP endpoint. Its otherwise unused field
// keeps the invitation secret on the Sprite's persistent disk, without a key file.
export function persistentJudgeSecret(db:KaiDatabase) {
  return db.transaction(() => {
    const row=db.prepare("SELECT mcp_token FROM workspaces WHERE id='public'").get() as {mcp_token:string|null};
    if (row.mcp_token) return row.mcp_token;
    const secret=randomBytes(32).toString('hex');
    db.prepare("UPDATE workspaces SET mcp_token=? WHERE id='public'").run(secret);
    return secret;
  })();
}
// The public copy cannot upload. Its unused upload field holds only Copal's
// download secret; sharing lookups always require kind='judge'.
export function persistentDownloadSecret(db:KaiDatabase) {
  return db.transaction(()=> {
    const row=db.prepare("SELECT upload_token FROM workspaces WHERE id='public'").get() as {upload_token:string|null};
    if(row.upload_token)return row.upload_token;
    const secret=randomBytes(32).toString('hex');
    db.prepare("UPDATE workspaces SET upload_token=? WHERE id='public'").run(secret);return secret;
  })();
}
