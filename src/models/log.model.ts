import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsString } from 'class-validator';

export interface Log {
  level: string;
  message: string;
  meta?: any;
  timestamp: Date;
}

export class CreateLogDto {
  @IsString()
  public level: string;

  @IsString()
  public message: string;

  @IsOptional()
  public metadata: any;
}

const LogSchema = new mongoose.Schema({
  level: {
    type: String
  },
  message: {
    type: String
  },
  meta: {
    type: Object
  },
  timestamp: {
    type: Date
  }
});

const LogModel = mongoose.model<Log & mongoose.Document>('Log', LogSchema);

export default LogModel;
