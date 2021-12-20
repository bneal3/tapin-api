import * as mongoose from 'mongoose';

import { AccessType } from '../interfaces/index';
import { ScoreModel, Score, CreateScoreDto, UserModel, User } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService, userService } from '../services/index';

class ScoreService {
  private static instance: ScoreService;
  private score = ScoreModel;
  private user = UserModel;

  public createScore = async (messageData: CreateScoreDto) => {
    
  }

  public static getInstance(): ScoreService {
    if(!ScoreService.instance) {
      ScoreService.instance = new ScoreService();
    }
    return ScoreService.instance;
  }
}

export default ScoreService;
