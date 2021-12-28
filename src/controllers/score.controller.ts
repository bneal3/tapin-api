import * as express from 'express';
import * as mongoose from 'mongoose';

import { Controller, RequestWithUser } from '../interfaces/index';
import { Score, ScoreModel, CreateScoreDto, UserModel, User } from '../models/index';
import { BadParametersException, ServerProcessException, NotAuthorizedException, ObjectNotFoundException, HttpException } from '../utils/index';
import { logger } from '../utils/index';
import { admin, authorize } from '../middleware/index';
import { scoreService, userService } from '../services/index';

class ScoreController implements Controller {
  public path = '/scores';
  public router = express.Router();
  private score = ScoreModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, authorize, this.get);
  }

  private get = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    try {
      const scores = await scoreService.getScores(request.query);
      response.send(scores);
    } catch (err) {
      next(err);
    }
  }
}

export default ScoreController;
