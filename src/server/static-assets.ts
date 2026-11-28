import express from 'express';
import path from 'node:path';

export function serveAssets(directory=path.resolve('dist/assets')) {
 return express.static(directory,{setHeaders(res,file){
  // Vite changes the filename whenever content changes. Only these public
  // build artifacts may outlive a visit; HTML and notebook APIs stay no-store.
  res.setHeader('Cache-Control',/-[\w-]{8,}\.[a-z0-9]+$/i.test(path.basename(file))?'public, max-age=31536000, immutable':'no-store');
 }});
}
