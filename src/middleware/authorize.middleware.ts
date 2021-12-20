import { NextFunction, Response, Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import * as passport from 'passport';

import { NotAuthorizedException } from '../utils/exceptions';
import { RequestWithUser, AuthenticationTokenData } from '../interfaces/index';
import { AuthenticationModel, UserModel, User } from '../models/index';

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
      passport.authenticate('jwt', async function (err, user) {
        if(err || !user) {
          reject(new NotAuthorizedException());
        } else {
          resolve(user);
        }
      })(request, response, next);
    });
  } else {
    throw new NotAuthorizedException();
  }
}

// async function permission(request: Request, response: Response, next: NextFunction): Promise<(User & mongoose.Document)> {
//   if(request.headers.authorization && request.headers.authorization.split(' ')[1] !== 'null') {
//     return await new Promise((resolve, reject) => {
//       passport.authenticate('jwt', async function (err, user) {
//         if(err || !user || !user.admin) {
//           reject(new NotAuthorizedException());
//         } else {
//           resolve(user);
//         }
//       })(request, response, next);
//     });
//   } else {
//     throw new NotAuthorizedException();
//   }
// }

// } else if(request.header('x-authorize')) {
//   const authentication = await AuthenticationModel.findOne({ _si: request.header('x-authorize') });
//   if(authentication) {
//     const jwtPayload: AuthenticationTokenData = <AuthenticationTokenData>jwt.verify(authentication.token, process.env.JWT_SECRET);
//     return await UserModel.findById(jwtPayload._id);
//   } else {
//     throw new NotAuthorizedException();
//   }

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
