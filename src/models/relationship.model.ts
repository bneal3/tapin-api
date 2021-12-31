import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsDate, IsString, IsObject, IsArray } from 'class-validator';

import { User } from './user.model';

export interface Relationship {
  userIds: string[];
  score: number;
  dateCreated: Date;
}

export class CreateRelationshipDto {
  @IsOptional()
  public contactId: string;

  @IsOptional()
  public email: string;

  @IsOptional()
  public name: string;
}

const RelationshipSchema = new mongoose.Schema({
  userIds: {
    type: [String],
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

const RelationshipModel = mongoose.model<Relationship & mongoose.Document>('Relationship', RelationshipSchema);

export default RelationshipModel;
