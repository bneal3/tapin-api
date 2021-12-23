import * as mongoose from 'mongoose';
import { IsOptional, IsNumber, IsDateString, IsString, IsBoolean } from 'class-validator';

import { User } from './user.model';

export enum MeetingStatus {
  Pending,
  Accepted,
  Happened,
  Canceled
}

export interface Meeting {
  googleEventId: string;
  initiator: mongoose.Schema.Types.ObjectId | User;
  recipient: mongoose.Schema.Types.ObjectId | User;
  title: string;
  status: MeetingStatus;
  dateCreated: Date;
  dateStart: Date;
  dateEnd: Date;
  dateStatusLastUpdated: Date;
}

export class CreateMeetingDto {
  @IsOptional()
  public recipientId: string;

  @IsOptional()
  public email: string;

  @IsOptional()
  public name: string;

  @IsOptional()
  public recipient: (User & mongoose.Document);

  @IsString()
  public title: string;

  @IsString()
  public timeStart: string;

  @IsOptional()
  public dateStart: Date;

  @IsString()
  public timeEnd: string;

  @IsOptional()
  public dateEnd: Date;
}

export class EditMeetingDto {
  @IsString()
  public title: string;

  @IsOptional()
  public status: number;

  @IsOptional()
  public timeStart: string;

  @IsOptional()
  public dateStart: Date;

  @IsOptional()
  public timeEnd: string;

  @IsOptional()
  public dateEnd: Date;

  @IsOptional()
  public dayStatusLastUpdated: string;

  @IsOptional()
  public dateStatusLastUpdated: Date;
}

const MeetingSchema = new mongoose.Schema({
  googleEventId: {
    type: String,
    unique: true,
    required: true
  },
  initiator: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipient: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    default: MeetingStatus.Pending
  },
  dateCreated: {
    type: Date,
    default: Date.now
  },
  dateStart: {
    type: Date,
    required: true
  },
  dateEnd: {
    type: Date,
    required: true
  },
  dateStatusLastUpdated: {
    type: Date,
    default: Date.now
  }
});

const MeetingModel = mongoose.model<Meeting & mongoose.Document>('Meeting', MeetingSchema);

export default MeetingModel;
