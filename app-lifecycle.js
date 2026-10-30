let active = null;
const listeners = new Set();
export function currentApp(){return active}
export function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
export function launchApp(id){const previous=active;active=id;listeners.forEach(fn=>fn({type:"launch",id,previous}));}
export function closeApp(){const previous=active;active=null;listeners.forEach(fn=>fn({type:"close",previous}));}
