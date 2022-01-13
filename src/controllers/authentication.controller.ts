import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

import { email, EmailTemplate, NotAuthorizedException, BadParametersException } from '../utils';
import { Controller, RequestWithUser, AuthenticationTokenData } from '../interfaces/index';
import { admin, authorize, validation } from '../middleware/index';
import { AuthenticationModel, SignInDto, ApprovalDto, UserModel, User } from '../models/index';
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
    this.router.post(`${this.path}/signin`, validation(SignInDto), this.postSignIn);
    this.router.post(`${this.path}/approval`, admin, validation(ApprovalDto), this.postApproval);
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

  private postApproval = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const approvalData: ApprovalDto = request.body;
    try {
      // FLOW: Send approval email
      const name = email.formatNames(approvalData.name);
      await email.sendTemplateEmail(EmailTemplate.Approval, [{ email: approvalData.email , name: approvalData.name }], {
        FIRSTNAME: name.first,
        LASTNAME: name.last,
        APPURL: process.env.APP_URL,
        NOREPLYEMAIL: process.env.NOREPLY_EMAIL
      }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
      response.send(approvalData);
    } catch (err) {
      next(err);
    }
  }
}

export default AuthenticationController;
