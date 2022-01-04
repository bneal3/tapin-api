import * as passport from 'passport';
import { UserModel } from '../models/index';
import { ServerProcessException, NotAuthorizedException } from '../utils/exceptions';
import { AuthenticationTokenData } from '../interfaces/index';

const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

passport.use(
  new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  }, async function (jwtPayload: AuthenticationTokenData, done: any) {
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
  })
);

module.exports = null;
