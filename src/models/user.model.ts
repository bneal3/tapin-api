import * as mongoose from 'mongoose';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsString, IsBoolean, IsObject } from 'class-validator';

export interface User {
  _id: mongoose.Types.ObjectId;
  googleAuthId: string;
  googleAuthToken: string;
  email: string;
  name: string;
  referrer?: mongoose.Schema.Types.ObjectId | User;
  dateCreated: Date;
  dateRegistered?: Date;
}

export class RegisterUserDto {
  @IsString()
  public googleAuthToken: string;

  @IsOptional()
  public googleAuthId: string;

  @IsString()
  public email: string;

  @IsString()
  public name: string;
}

export class EditUserDto {
  @IsOptional()
  public email: string;

  @IsOptional()
  public name: string;
}

export class UserDto {
  @IsOptional()
  public _id: any;

  @IsOptional()
  public googleAuthToken: string;

  @IsOptional()
  public googleAuthId: string;

  @IsOptional()
  public email: string;

  @IsOptional()
  public name: string;

  @IsOptional()
  public referrer: string;

  @IsOptional()
  public dayRegistered: string;

  @IsOptional()
  public dateRegistered: Date;
}

const UserSchema = new mongoose.Schema({
  googleAuthToken: {
    type: String
  },
  googleAuthId: {
    type: String
  },
  email: {
    type: String,
    trim: true,
    index: true,
    unique: true,
    sparse: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  referrer: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId
  },
  dateCreated: {
    type: Date,
    default: Date.now
  },
  dateRegistered: {
    type: Date
  }
});

const UserModel = mongoose.model<User & mongoose.Document>('User', UserSchema);

export default UserModel;
