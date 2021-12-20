import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsDate, IsString } from 'class-validator';

import { User } from './user.model';

export interface Score {
  user: mongoose.Schema.Types.ObjectId | User;
  target: mongoose.Schema.Types.ObjectId | User;
  value: Number;
  dateCreated: Date;
}

export class CreateScoreDto {
  @IsString()
  public target: string;

  @IsNumber()
  public value: number;
}

const ScoreSchema = new mongoose.Schema({
  user: {
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
    required: true
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

const ScoreModel = mongoose.model<Score & mongoose.Document>('Score', ScoreSchema);

export default ScoreModel;
