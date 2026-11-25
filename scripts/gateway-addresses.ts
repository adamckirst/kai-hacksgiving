import { discoverGateways } from '../src/server/gateway';
discoverGateways().then(config=>process.stdout.write(JSON.stringify(config))).catch(()=> {console.error('Gateway discovery failed.');process.exitCode=1;});
