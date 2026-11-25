import type { Express,Request,Response,NextFunction,RequestHandler } from 'express';
import type { KaiDatabase } from './db';
import { addAudio } from './audio';
import { ReadingError,realDate } from './reading';

export function mountSharing(app:Express,db:KaiDatabase,upload:RequestHandler,directory:string,work:()=>unknown) {
  // A sharing address authorizes only this upload route, never browser access.
  app.all('/in/:address',(req:Request,res:Response,next:NextFunction)=> {
    const address=req.params.address;
    const row=typeof address==='string' && /^[a-f0-9]{64}$/.test(address) ? db.prepare("SELECT id FROM workspaces WHERE kind='judge' AND upload_token=?").get(address) as {id:string}|undefined : undefined;
    if(!row){res.status(404).json({error:'Address not found.'});return;}
    if(req.method!=='POST'){res.status(405).set('Allow','POST').json({error:'Share an audio file to this address.'});return;}
    if(req.get('origin')){res.status(403).json({error:'Use your phone shortcut to share a recording.'});return;}
    res.locals.sharingWorkspace=row.id;next();
  },upload,async(req,res)=> {
    try {
      const files=req.files as Express.Multer.File[]|undefined;
      let dates:unknown;
      if(typeof req.body?.date==='string') {
        const date=req.body.date;
        if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !realDate.safeParse(date.slice(0,10)).success || files?.length!==1) throw new ReadingError('Share one recording with its original date.');
        dates=[Date.parse(date)];
      } else dates=JSON.parse(req.body?.dates ?? '[]');
      if(!files || !Array.isArray(dates) || dates.length!==files.length)throw new ReadingError('Share recordings with their original dates.');
      const timestamps=dates;
      const ids=await addAudio(db,res.locals.sharingWorkspace,files.map((f,i)=>({name:f.originalname,buffer:f.buffer,date:timestamps[i]})),directory,'shared');
      res.status(202).json({ids});void work();
    }catch(error) {
      if(error instanceof ReadingError)res.status(error.status).json({error:error.message});
      else if(error instanceof SyntaxError)res.status(400).json({error:'The recording dates could not be read.'});else throw error;
    }
  });
}
