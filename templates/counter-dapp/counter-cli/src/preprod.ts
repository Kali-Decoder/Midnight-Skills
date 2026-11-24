import { createLogger } from './logger-utils.js';
import { run } from './cli.js';
import { PreprodConfig } from './config.js';

const config = new PreprodConfig();
const logger = await createLogger(config.logDir);
await run(config, logger);
