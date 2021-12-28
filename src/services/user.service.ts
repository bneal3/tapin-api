import * as bcrypt from 'bcryptjs';
import * as mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';

import { HttpException, NotAuthorizedException, ObjectAlreadyExistsException, ObjectNotFoundException, ServerProcessException, BadParametersException  } from '../utils/index';
import { AuthenticationModel, Authentication, UserModel, User, EditUserDto, UserDto } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService } from '../services/index';

class UserService {
  private static instance: UserService;
  private authentication = AuthenticationModel;
  private user = UserModel;

  public getUsers = async (query: any) => {
    let ids: string[] = query.ids ?? [];
    const emails: string[] = query.emails ?? [];
    ids = ids.filter((id) => {
      if(mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
    });
    // FLOW: Get users
    const users = await this.user.find({
      $or: [
        { _id: { $in: ids }},
        { email: { $in: emails }}
      ]
    }).catch((err: Error) => { return undefined; });
    if(users) {
      return users;
    } else {
      throw new ObjectNotFoundException('identifier(s)');
    }
  }

  public userData = async (user: (User & mongoose.Document)) => {
    const data: any = user.toObject();
    return data;
  }

  public editMe = async (user: (User & mongoose.Document), editUserData: EditUserDto) => {
    if(editUserData.email) { editUserData.email = this.sanitizeEmail(editUserData.email); }
    // TODO: Add scores to user if email already exists in database
    try {
      user = await this.user.findByIdAndUpdate(user._id, editUserData, { new: true });
    } catch (err) {
      if(err.message.indexOf('email') > -1) {
        throw new ObjectAlreadyExistsException('User', 'email address');
      } else {
        throw new HttpException(400, err.message);
      }
    }
    return user;
  }

  public sanitizeEmail(email: string) {
    // SANITIZE: Lowercase email
    email = email.toLowerCase();
    // SANITIZE: Trim whitespace
    email = email.replace(/\s/g,'');
    // VALIDATE: User submits actual email address
    const regex = RegExp(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    if(!regex.test(email)) { throw new HttpException(400, 'You must enter a valid email address'); }
    return email;
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }
}

export default UserService;
