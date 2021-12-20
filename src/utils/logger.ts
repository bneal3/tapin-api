import * as winston from 'winston';
import { MongoDB } from 'winston-mongodb';
import * as Amplitude from '@amplitude/node';

class Logger {
  private static instance: Logger;
  public demand: Amplitude.NodeClient;
  public supply: Amplitude.NodeClient;
  public logger: winston.Logger;
  private transport = new MongoDB({
    level: 'info',
    db: process.env.MONGODB_URI ?? `mongodb://localhost:27017/ReachMeApp`,
    options: {
      useUnifiedTopology: true
    },
    collection: 'logs'
  });

  constructor() {
    this.demand = Amplitude.init(process.env.AMPLITUDE_DEMAND_KEY);
    this.supply = Amplitude.init(process.env.AMPLITUDE_SUPPLY_KEY);
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
