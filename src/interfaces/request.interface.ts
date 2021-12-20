import { Request } from 'express';
import * as mongoose from 'mongoose';

import { User } from '../models/user.model';

export enum AccessType {
  auth = 'auth',
  lock = 'lock',
}

export interface RequestWithUser extends Request {
  user: (User & mongoose.Document);
}

export interface AuthenticationTokenData {
  _id: string;
  auth: string;
}
