import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsDate, IsString, IsObject } from 'class-validator';

import { User } from './user.model';

export interface Score {
  source: mongoose.Schema.Types.ObjectId | User;
  target: mongoose.Schema.Types.ObjectId | User;
  value: number;
  dateCreated: Date;
}

export class CreateScoreDto {
  @IsObject()
  public target: (User & mongoose.Document);
}

export class UpdateScoreDto {
  @IsNumber()
  public value: number;
}

const ScoreSchema = new mongoose.Schema({
  source: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  target: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  value: {
    type: Number,
    default: 0
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

const ScoreModel = mongoose.model<Score & mongoose.Document>('Score', ScoreSchema);

export default ScoreModel;
