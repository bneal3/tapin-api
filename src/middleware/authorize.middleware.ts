import { NextFunction, Response, Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import * as passport from 'passport';

const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

import { NotAuthorizedException, ServerProcessException } from '../utils/exceptions';
import { RequestWithUser, AuthenticationTokenData, AccessType } from '../interfaces/index';
import { AuthenticationModel, Authentication, UserModel, User } from '../models/index';

const jwtStrategy = new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, jwtStrategyCallback);

const jwtNoExpirationStrategy = new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  ignoreExpiration: true
}, jwtStrategyCallback);

async function jwtStrategyCallback(jwtPayload: AuthenticationTokenData, done: any) {
  try {
    const user = await UserModel.findById(jwtPayload.userId);
    if(!user) {
      done(new NotAuthorizedException(), false);
    } else {
      done(null, {
        payload: jwtPayload,
        user: user
      });
    }
  } catch (err) {
    done(new ServerProcessException('Problem authorizing request', { namespace: 'utils.passport', err }), false);
  }
}

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
    const token = request.headers.authorization.split(' ')[1];
    const authentication = await AuthenticationModel.findOne({ token: token });
    if(authentication) {
      let strategy = jwtStrategy;
      if(authentication.access === AccessType.Single) { strategy = jwtNoExpirationStrategy; }
      return await new Promise((resolve, reject) => {
        passport.authenticate(strategy, async function (err, res) {
          if(err || !res.user) {
            reject(new NotAuthorizedException());
          } else {
            if(res.payload.access === AccessType.Auth || (res.payload.access === AccessType.Single && authentication.uses === 0)) {
              // FLOW: Add one to uses on authentication
              await AuthenticationModel.findByIdAndUpdate(authentication._id, { uses: authentication.uses + 1 }, { new: true });
              resolve(res.user);
            } else {
              throw new NotAuthorizedException();
            }
          }
        })(request, response, next);
      });
    } else {
      throw new NotAuthorizedException();
    }
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
