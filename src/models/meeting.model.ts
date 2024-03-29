import * as mongoose from 'mongoose';
import { IsOptional, IsNumber, IsDateString, IsString, IsBoolean } from 'class-validator';

import { User } from './user.model';

export enum MeetingStatus {
  Pending,
  Accepted,
  Rejected,
  Happened,
  Canceled
}

export interface Meeting {
  googleEventId: string;
  initiator: mongoose.Schema.Types.ObjectId | User;
  recipient: mongoose.Schema.Types.ObjectId | User;
  title: string;
  status: MeetingStatus;
  confirmed: string[];
  dateCreated: Date;
  dateStart: Date;
  dateEnd: Date;
  dateStatusLastUpdated: Date;
}

export class CreateMeetingDto {
  @IsString()
  public recipientId: string;

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
  @IsOptional()
  public title: string;

  @IsOptional()
  public status: number;

  @IsOptional()
  public confirmed: boolean;

  @IsOptional()
  public timeStart: string;

  @IsOptional()
  public dateStart: Date;

  @IsOptional()
  public timeEnd: string;

  @IsOptional()
  public dateEnd: Date;

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
  confirmed: {
    type: [String],
    default: []
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
