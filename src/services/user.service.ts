import * as bcrypt from 'bcryptjs';
import * as mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';

import { HttpException, NotAuthorizedException, ObjectAlreadyExistsException, ObjectNotFoundException, ServerProcessException, BadParametersException, UnrecognizedCredentialsException } from '../utils/index';
import { AuthenticationModel, Authentication, RelationshipModel, UserModel, User, EditUserDto, EditContactDto, UserDto } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService } from '../services/index';

class UserService {
  private static instance: UserService;
  private authentication = AuthenticationModel;
  private relationship = RelationshipModel;
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
    user.googleRefreshToken = undefined;
    return data;
  }

  public editMe = async (user: (User & mongoose.Document), editUserData: EditUserDto) => {
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

  public editContact = async (user: (User & mongoose.Document), _id: string, editContactData: EditContactDto) => {
    let contact = await this.user.findById(_id);
    if(contact) {
      const relationship = await this.relationship.findOne({ userIds: { $in: [user._id.toString(), contact._id.toString()] } });
      if(relationship) {
        try {
          contact = await this.user.findByIdAndUpdate(contact._id, editContactData, { new: true });
          return contact;
        } catch (err) {
          throw new HttpException(400, err.message);
        }
      } else {
        throw new UnrecognizedCredentialsException();
      }
    } else {
      throw new BadParametersException();
    }
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
