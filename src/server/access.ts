import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { seed, type KaiDatabase } from './db';
export const cookieName = 'kai_session';
export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left,right);
}
function signature(id: string, secret: string) {
  return createHmac('sha256',secret).update(`browser:${id}`).digest('hex');
}
export function workspaceFor(db: KaiDatabase, req: Request): string {
  const value = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!value || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value)) return 'public';
  const [id,mac] = value.split('.');
  const row = db.prepare("SELECT upload_token FROM workspaces WHERE id = ? AND kind = 'judge'").get(id) as {upload_token:string}|undefined;
  return row && equalSecret(mac,signature(id,row.upload_token)) ? id : 'public';
}
export function createJudge(db: KaiDatabase) {
  const id = randomUUID(); seed(db,new Date(),id);
  const row = db.prepare('SELECT upload_token FROM workspaces WHERE id = ?').get(id) as {upload_token:string};
  return {id,cookie:`${id}.${signature(id,row.upload_token)}`};
}
