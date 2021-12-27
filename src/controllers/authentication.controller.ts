import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

import { NotAuthorizedException, BadParametersException } from '../utils';
import { Controller, RequestWithUser, AuthenticationTokenData } from '../interfaces/index';
import { admin, authorize, auth, validation } from '../middleware/index';
import { AuthenticationModel, LoginDto, UserModel, User, RegisterUserDto } from '../models/index';
import { logger} from '../utils/index';
import { authenticationService, userService } from '../services/index';

class AuthenticationController implements Controller {
  public path = '/auth';
  public router = express.Router();
  public user = UserModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, this.getAuthentication);
    this.router.post(`${this.path}/register`, validation(RegisterUserDto), this.postRegister);
    this.router.post(`${this.path}/login`, validation(LoginDto), this.postLogin);
  }

  private getAuthentication = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    try {
      if(request.query._si) {
        const authentication = await authenticationService.get(<string>request.query._si);
        response.send(authentication);
      } else {
        throw new NotAuthorizedException();
      }
    } catch (err) {
      next(err);
    }
  }

  private postRegister = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const userData: RegisterUserDto = request.body;
    try {
      const { authentication, user } = await authenticationService.register(userData);
      response.send({
        token: authentication.token,
        user: await userService.userData(user)
      });
    } catch (err) {
      next(err);
    }
  }

  private postLogin = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const loginData: LoginDto = request.body;
    try {
      const { authentication, user } = await authenticationService.login(loginData);
      response.send({
        token: authentication.token,
        user: await userService.userData(user)
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AuthenticationController;
