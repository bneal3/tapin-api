import * as mongoose from 'mongoose';

import { HttpException, NotAuthorizedException, ObjectAlreadyExistsException, ObjectNotFoundException, ServerProcessException, BadParametersException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { ScoreModel, Score, CreateScoreDto, UpdateScoreDto, UserModel, User } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService, userService } from '../services/index';

class ScoreService {
  private static instance: ScoreService;
  private score = ScoreModel;
  private user = UserModel;

  public getScores = async (query: any) => {
    let ids: string[] = query.ids ?? [];
    let sources: string[] = query.sources ?? [];
    let targets: string[] = query.targets ?? [];
    ids = ids.filter((id) => {
      if(mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
    });
    sources = sources.filter((source) => {
      if(mongoose.Types.ObjectId.isValid(source)) {
        return source;
      }
    });
    targets = targets.filter((target) => {
      if(mongoose.Types.ObjectId.isValid(target)) {
        return target;
      }
    });
    // FLOW: Get users
    const scores = await this.user.find({
      $or: [
        { _id: { $in: ids }},
        { source: { $in: sources }},
        { target: { $in: targets }}
      ]
    }).catch((err: Error) => { return undefined; });
    if(scores) {
      return scores;
    } else {
      throw new ObjectNotFoundException('identifier(s)');
    }
  }

  public createScore = async (scoreData: CreateScoreDto) => {
    return this.score.create(scoreData);
  }

  public updateScore = async (_id: string, scoreData: UpdateScoreDto) => {
    const score = await this.score.findById(_id);
    if(score) {
      return this.score.findOneAndUpdate(score._id, scoreData, { new: true });
    } else {
      throw new BadParametersException();
    }
  }

  public static getInstance(): ScoreService {
    if(!ScoreService.instance) {
      ScoreService.instance = new ScoreService();
    }
    return ScoreService.instance;
  }
}

export default ScoreService;
