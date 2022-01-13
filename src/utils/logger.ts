import * as winston from 'winston';
import { MongoDB } from 'winston-mongodb';

class Logger {
  private static instance: Logger;
  public logger: winston.Logger;
  private transport = new MongoDB({
    level: 'info',
    db: process.env.MONGODB_URI ?? `mongodb://localhost:27017/TapInApp`,
    options: {
      useUnifiedTopology: true
    },
    collection: 'logs'
  });

  constructor() {
    this.logger = winston.createLogger({
      exitOnError: false,
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({ level: 'debug' }),
        this.transport
      ]
    });
    this.logger.on('error', function (err) {
      console.log(err);
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
}

export default Logger;
