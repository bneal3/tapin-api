import * as mongoose from 'mongoose';
import { IsOptional, IsNumber, IsDateString, IsString, IsBoolean } from 'class-validator';

import { User } from './user.model';

export enum MeetingStatus {
  Pending,
  Accepted,
  Happened,
  Canceled,
  Ghosted,
  Deleted
}

export interface Meeting {
  initiator: mongoose.Types.ObjectId | User;
  recipient: mongoose.Types.ObjectId | User;
  title: String;
  status: MeetingStatus;
  dateCreated: Date;
  dateMeeting: Date;
  dateStatusLastUpdated: Date;
}

export class CreateMeetingDto {
  @IsString()
  public recipientId: string;

  @IsString()
  public title: string;

  @IsOptional()
  public dayMeeting: string;

  @IsOptional()
  public dateMeeting: Date;
}

export class EditMeetingDto {
  @IsString()
  public title: string;

  @IsOptional()
  public status: number;

  @IsOptional()
  public dayMeeting: string;

  @IsOptional()
  public dateMeeting: Date;

  @IsOptional()
  public dayStatusLastUpdated: string;

  @IsOptional()
  public dateStatusLastUpdated: Date;
}

const MeetingSchema = new mongoose.Schema({
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
  dateMeeting: {
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
