import * as mongoose from 'mongoose';
import { Request } from 'express';

import { User } from '../models/user.model';

export enum AccessType {
  Auth = 'auth',
  Single = 'single'
}

export interface AuthenticationTokenData {
  _id: string;
  userId: string;
  access: string;
}

export interface RequestWithUser extends Request {
  user: (User & mongoose.Document);
}
