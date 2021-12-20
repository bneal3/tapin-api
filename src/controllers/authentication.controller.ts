import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

import { NotAuthorizedException, BadParametersException } from '../utils';
import { Controller, RequestWithUser, AuthenticationTokenData } from '../interfaces/index';
import { admin, authorize, auth, validation } from '../middleware/index';
import { AuthenticationModel, VerificationEmailDto, LoginDto, CredentialsDto, UserModel, User, RegisterUserDto } from '../models/index';
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
    this.router.post(`${this.path}/verify/email`, validation(VerificationEmailDto), this.postVerifyEmail);
    this.router.post(`${this.path}/register`, validation(RegisterUserDto), this.postRegister);
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

  private postVerifyEmail = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const verificationEmailData: VerificationEmailDto = request.body;
    try {
      // FLOW: Get user if one not in set to account
      let user: (User & mongoose.Document);
      if(verificationEmailData.current === verificationEmailData.target) {
        user = await this.user.findOne({ email: verificationEmailData.current });
      } else {
        user = await auth(request, response, next);
      }
      if(user) {
        await authenticationService.verifyEmail(verificationEmailData, user);
        response.send();
      } else {
        throw new NotAuthorizedException();
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  private postRegister = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const userData: RegisterUserDto = request.body;
    try {
      await authenticationService.register(userData);
      response.send({});
    } catch (err) {
      next(err);
    }
  }
}

export default AuthenticationController;
