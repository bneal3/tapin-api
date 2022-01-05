import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as express from 'express';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as path from 'path';

import './config/index';

import { Controller } from './interfaces/index';
import Logger from './utils/logger';
import { connectToDatabase } from './utils';
import { error } from './middleware/index';

class App {
  private readonly app: express.Application;

  constructor(controllers: Controller[]) {
    this.app = express();

    connectToDatabase();
    this.initializeMiddleware();
    this.initializeControllers(controllers);
    this.initializeViews();
    this.app.use(error);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async listen() {
    this.app.listen(process.env.PORT, () => {
      Logger.getInstance().logger.debug(`App listening on port ${process.env.PORT}`);
    });
  }

  private initializeMiddleware() {
    // Security
    this.app.disable('x-powered-by');
    this.app.use(cors());
    this.app.use(helmet());
    this.app.use(helmet.hidePoweredBy({ setTo: 'PHP 4.2.0' }));
    this.app.use(helmet.referrerPolicy({ policy: 'same-origin' }));

    // Express
    this.app.use(bodyParser.json());

    // Logging
    this.app.use(morgan('combined'));
  }

  private initializeControllers(controllers: any) {
    controllers.forEach((controller: any) => {
      this.app.use('/', controller.router);
    });
  }

  private initializeViews() {
    this.app.use(express.static(path.join(__dirname, 'public')));
  }
}

export default App;
