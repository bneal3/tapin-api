import { NextFunction, Response, Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import * as passport from 'passport';

import { NotAuthorizedException } from '../utils/exceptions';
import { RequestWithUser, AuthenticationTokenData, AccessType } from '../interfaces/index';
import { AuthenticationModel, Authentication, UserModel, User } from '../models/index';

async function authorize(request: RequestWithUser, response: Response, next: NextFunction) {
  try {
    request.user = await auth(request, response, next);
    next();
  } catch (err) {
    next(err);
  }
}

async function auth(request: Request, response: Response, next: NextFunction): Promise<(User & mongoose.Document)> {
  if(request.headers.authorization && request.headers.authorization.split(' ')[1] !== 'null') {
    return await new Promise((resolve, reject) => {
      passport.authenticate('jwt', async function (err, res) {
        if(err || !res.user) {
          reject(new NotAuthorizedException());
        } else {
          const authentication = await AuthenticationModel.findOne({ user: res.user._id });
          if(authentication) {
            if(res.payload.access === AccessType.Auth || (res.payload.access === AccessType.Single && authentication.uses === 0)) {
              // FLOW: Add one to uses on authentication
              await AuthenticationModel.findByIdAndUpdate(authentication._id, { uses: authentication.uses + 1 }, { new: true });
              resolve(res.user);
            } else {
              throw new NotAuthorizedException
            }
          } else {
            throw new NotAuthorizedException();
          }
        }
      })(request, response, next);
    });
  } else {
    throw new NotAuthorizedException();
  }
}

async function admin(request: Request, response: Response, next: NextFunction) {
  const key = request.header('x-admin');
  if (key === process.env.ADMIN_SECRET) {
    next();
  } else {
    next(new NotAuthorizedException());
  }
}

export {
  authorize, auth, admin
};
