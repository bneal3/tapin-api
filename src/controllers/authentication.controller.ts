import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

import { NotAuthorizedException, BadParametersException } from '../utils';
import { Controller, RequestWithUser, AuthenticationTokenData } from '../interfaces/index';
import { admin, authorize, auth, validation } from '../middleware/index';
import { AuthenticationModel, SignInDto, UserModel, User } from '../models/index';
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
    this.router.post(`${this.path}/signin`, validation(SignInDto), this.postSignIn);
  }

  private getAuthentication = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    try {
      if(request.query._si) {
        const authentication = await authenticationService.get(<string>request.query._si);
        response.send(authentication);
      } else {
        throw new BadParametersException();
      }
    } catch (err) {
      next(err);
    }
  }

  private postSignIn = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const userData: SignInDto = request.body;
    try {
      const { authentication, user } = await authenticationService.signIn(userData);
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
