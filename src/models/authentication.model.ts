import * as mongoose from 'mongoose';
import { IsOptional, IsString } from 'class-validator';

import { User } from './user.model';

export interface Authentication {
  user: mongoose.Types.ObjectId | User;
  token: string;
  expiration: number;
  dateIssued: Date;
}

export class SignInDto {
  @IsString()
  public googleAuthCode: string;
}

const AuthenticationSchema = new mongoose.Schema({
  user: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
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
