type Visibility = EventTarget & {visibilityState:string};

/** One request at a time; background tabs pause and returning tabs refresh now. */
export function visiblePoll(
  read:(signal:AbortSignal)=>Promise<void>,
  interval:number|(()=>number),
  visibility:Visibility=document,
  lifecycle:EventTarget=window,
) {
  let stopped=false,running=false,requested=false,timer:ReturnType<typeof setTimeout>|undefined;
  let controller:AbortController|undefined;
  function clear(){if(timer!==undefined){clearTimeout(timer);timer=undefined;}}
  async function refresh(){
    clear();if(stopped || visibility.visibilityState==='hidden')return;
    if(running){requested=true;return;}
    running=true;controller=new AbortController();
    try {await read(controller.signal);}catch{/* The caller owns its visible error state. */}
    finally {
      running=false;
      if(stopped || visibility.visibilityState==='hidden')return;
      if(requested){requested=false;void refresh();}
      else timer=setTimeout(()=>void refresh(),typeof interval==='function'?interval():interval);
    }
  }
  const resume=()=>{if(visibility.visibilityState==='hidden'){clear();requested=false;}else void refresh();};
  visibility.addEventListener('visibilitychange',resume);
  lifecycle.addEventListener('pageshow',resume);lifecycle.addEventListener('focus',resume);
  void refresh();
  return {refresh,stop(){stopped=true;clear();controller?.abort();visibility.removeEventListener('visibilitychange',resume);lifecycle.removeEventListener('pageshow',resume);lifecycle.removeEventListener('focus',resume);}};
}
