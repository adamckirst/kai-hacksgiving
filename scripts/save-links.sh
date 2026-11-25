#!/usr/bin/env bash
set -euo pipefail
# Run only after Copal authorizes making kai's URL public. Never print the links.
if [[ $# -ne 1 ]]; then
  printf '%s\n' 'Usage: scripts/save-links.sh <public Sprite URL>' >&2
  exit 2
fi
private_links="$(sprite exec -s kai --no-port-forward --stdin --dir /home/sprite/kai -- node --input-type=module - "$1" <<'JS'
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
let db;
try {
  const url=new URL(process.argv[2]);
  if(url.protocol!=='https:' || !/^kai-[a-z0-9-]+\.sprites\.app$/.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash || url.pathname!=='/')throw new Error();
  db=new Database('/home/sprite/kai-state/kai.sqlite');
  const links=db.transaction(()=> {
    const row=db.prepare("SELECT mcp_token,upload_token FROM workspaces WHERE id='public'").get();
    if(!row?.mcp_token)throw new Error();
    const download=row.upload_token ?? randomBytes(32).toString('hex');
    if(!row.upload_token)db.prepare("UPDATE workspaces SET upload_token=? WHERE id='public'").run(download);
    return `Judge: ${url.origin}/#judge=${row.mcp_token}\nDownload: ${url.origin}/operator#download=${download}\n`;
  })();
  process.stdout.write(links);
}catch{process.stderr.write('Private links could not be saved.\n');process.exitCode=1;}
finally{db?.close();}
JS
)"
umask 077
: > "$HOME/kai-links.txt"
chmod 600 "$HOME/kai-links.txt"
printf '%s\n' "$private_links" > "$HOME/kai-links.txt"
unset private_links
printf '%s\n' 'Private links saved to ~/kai-links.txt.'
