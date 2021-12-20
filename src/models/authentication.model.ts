import * as mongoose from 'mongoose';
import * as shortid from 'shortid';
import { IsOptional, IsString } from 'class-validator';

import { User } from './user.model';

export interface Authentication {
  user: mongoose.Types.ObjectId | User;
  _si: string;
  token: string;
  expiration: number;
  dateIssued: Date;
}

export class VerificationEmailDto {
  @IsString()
  public current: string;

  @IsString()
  public target: string;

  @IsOptional()
  public onboard: string;
}

export class LoginDto {
  @IsOptional()
  public requestId: string;

  @IsOptional()
  public code: string;

  @IsOptional()
  public phone: string;

  @IsOptional()
  public email: string;

  @IsOptional()
  public password: string;
}

export class CredentialsDto {
  @IsOptional()
  public alias: string;

  @IsOptional()
  public name: string;

  @IsOptional()
  public title: string;
}

const AuthenticationSchema = new mongoose.Schema({
  user: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  _si: {
    type: String,
    default: shortid.generate
  },
  token: {
    type: String,
    required: true
  },
  expiration: {
    type: Number,
    required: true
  },
  dateIssued: {
    type: Date,
    default: Date.now
  }
});

const AuthenticationModel = mongoose.model<Authentication & mongoose.Document>('Authentication', AuthenticationSchema);

export default AuthenticationModel;
