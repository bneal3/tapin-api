import * as express from 'express';
import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsString } from 'class-validator';

import { HttpException  } from '../utils/index';
import { Controller } from '../interfaces/index';
import { CreateLogDto } from '../models/index';
import { validation } from '../middleware/index';
import { logger } from '../utils/index';

class LogController implements Controller {
  public path = '/logs';
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}`, validation(CreateLogDto), this.postLogs);
  }

  private postLogs = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const logData: CreateLogDto = request.body;
    logger.logger.log(logData);
    response.send();
  }
}

export default LogController;
