import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../src/server/app';
import { openDatabase, seed, type KaiDatabase } from '../../src/server/db';
type Fixture = { db:KaiDatabase; secret:string };
export const test = base.extend<{}, {kai:Fixture}>({kai:[async ({},use) => {
  const db = openDatabase(); seed(db);
  const secret = randomBytes(32).toString('hex');
  const server = createApp(db,{judgeSecret:secret,secureCookies:false,videoUrl:process.env.VIDEO_URL}).listen(18520,'127.0.0.1');
  await new Promise<void>(resolve => server.once('listening',resolve));
  try {await use({db,secret});} finally {await new Promise<void>(resolve => server.close(() => resolve()));db.close();}
},{scope:'worker',auto:true}]});
export { expect };
