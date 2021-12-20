import * as express from 'express';
import * as mongoose from 'mongoose';

import { Controller, RequestWithUser } from '../interfaces/index';
import { Score, ScoreModel, CreateScoreDto, UserModel, User } from '../models/index';
import { BadParametersException, ServerProcessException, NotAuthorizedException, ObjectNotFoundException, HttpException } from '../utils/index';
import { logger, sendinblue } from '../utils/index';
import { admin, authorize } from '../middleware/index';
import { scoreService, userService } from '../services/index';

class ScoreController implements Controller {
  public path = '/scores';
  public router = express.Router();
  private score = ScoreModel;
  private user = UserModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, authorize, this.get);
  }

  private get = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    try {
      let user: any = request.query.user ?? { '$exists': true };
      let target: any = request.query.target ?? { '$exists': true };
      if(user === request.user._id.toString() || target === request.user._id.toString()) {
        // FLOW: Get scores
        const scores = await this.score.find({
          user: user,
          target: target
        }).sort('-dateCreated').catch((err: Error) => { return []; });
        if(scores.length > 0) {
          if(request.query.latest) {
            const score = scores[0];
            if(!request.query.user) {
              await score.populate('user').execPopulate();
            } else if(!request.query.target) {
              await score.populate('target').execPopulate();
            }
            response.send(score);
          } else {
            response.send(scores);
          }
        } else {
          throw new ObjectNotFoundException('identifier(s)');
        }
      } else {
        throw new BadParametersException();
      }
    } catch (err) {
      next(err);
    }
  }
}

export default ScoreController;
