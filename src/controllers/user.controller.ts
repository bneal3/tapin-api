import * as bcrypt from 'bcryptjs';
import * as express from 'express';
import * as mongoose from 'mongoose';
import * as path from 'path';

import { BadParametersException, NotAuthorizedException, ObjectAlreadyExistsException, ObjectNotFoundException } from '../utils/index';
import { AccessType, Controller, RequestWithUser } from '../interfaces/index';
import { authorize, admin, validation } from '../middleware/index';
import { UserModel, User, EditUserDto, EditContactDto, UserDto } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService, userService } from '../services/index';

class UserController implements Controller {
  public path = '/users';
  public router = express.Router();
  private user = UserModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, this.get);
    this.router.get(`${this.path}/me`, authorize, this.getMe);
    this.router.patch(`${this.path}/me`, authorize, validation(EditUserDto), this.patchMe);
    this.router.patch(`${this.path}/contact/:id`, authorize, validation(EditContactDto), this.patchContact);
  }

  private get = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    try {
      const users = await userService.getUsers(request.query);
      response.send(users);
    } catch (err) {
      next(err);
    }
  }

  private getMe = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    try {
      const userData = await userService.userData(request.user);
      userData.password = undefined;
      response.send(userData);
    } catch (err) {
      next(err);
    }
  }

  private patchMe = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    let editUserData: EditUserDto = request.body;
    try {
      request.user = await userService.editMe(request.user, editUserData);
      response.send(await userService.userData(request.user));
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  private patchContact = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    let editContactData: EditContactDto = request.body;
    if(mongoose.Types.ObjectId.isValid(request.params.id)) {
      try {
        const contact = await userService.editContact(request.user, request.params.id, editContactData);
        response.send(contact);
      } catch (err) {
        next(err);
      }
    } else {
      next(new BadParametersException(`id`, `not a valid id`));
    }
  }
}

export default UserController;
