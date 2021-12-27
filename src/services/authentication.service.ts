import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_AUTH_CLIENT_ID);

import { HttpException, ServerProcessException, BadParametersException, NotAuthorizedException, UnrecognizedCredentialsException, ObjectAlreadyExistsException, ObjectNotFoundException } from '../utils/index';
import { AccessType, AuthenticationTokenData } from '../interfaces/index';
import { AuthenticationModel, Authentication, LoginDto, ScoreModel, Score, UserModel, User, RegisterUserDto } from '../models/index';
import { logger, google, sendinblue, EmailTemplate } from '../utils/index';
import { userService } from '../services/index';

class AuthenticationService {
  private static instance: AuthenticationService;
  private authentication = AuthenticationModel;
  private score = ScoreModel;
  private user = UserModel;

  public get = async (_si: string) => {
    const authentication = await this.authentication.findOne({ _si: _si });
    if(authentication) {
      // FLOW: Get latest active authentication
      const latest = await this.authentication.findOne({ user: authentication.user }).sort('-dateIssued');
      return latest;
    } else {
      throw new ObjectNotFoundException('authentication');
    }
  }

  // FUNNEL: Step 2 - Register account
  public register = async (userData: RegisterUserDto) => {
    const payload = await this.verifyGoogleAuthToken(userData.googleAuthToken);
    userData.googleAuthId = payload['sub'];
    userData.email = payload['email'];
    userData.name = payload['name'];
    let user: (User & mongoose.Document) = await this.user.findOne({ email: userData.email });
    try {
      if(!user) {
        user = await this.user.create({
          ...userData,
          dateRegistered: Date.now()
        });
      } else if(!user.dateRegistered) {
        user = await this.user.findByIdAndUpdate(user._id, {
          name: userData.name,
          dateRegistered: new Date()
        }, { new: true });
        // FLOW: Add scores to user if email already exists in database
        const scores = await this.score.find({ target: user._id });
        const promises: any[] = [];
        scores.forEach((score) => {
          const relation = this.score.create({
            source: user._id,
            target: score.source,
            value: score.value
          });
          promises.push(relation);
        });
        await Promise.all(promises);
      }
      return await this.sanitizeTokenResponse(user);
    } catch (err) {
      if(err.message.indexOf('email') > -1) {
        throw new ObjectAlreadyExistsException('User', 'email');
      } else {
        throw new HttpException(400, err.message);
      }
    }
  }

  public login = async (loginData: LoginDto) => {
    const payload = await this.verifyGoogleAuthToken(loginData.googleAuthToken);
    return await this.findOneAndLogin({ googleAuthId: payload['sub'] }, loginData.googleAuthToken);
  }

  public verifyGoogleAuthToken = async (token: string) => {
    try {
      // FLOW: Verify auth token and get googleAuthId
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_AUTH_CLIENT_ID
      });
      const payload = ticket.getPayload();
      console.log(payload);
      return payload;
    } catch (err) {
      console.log(err);
      throw new UnrecognizedCredentialsException();
    }
  }

  public findOneAndLogin = async (identifier: any, googleAuthToken: string) => {
    let user = await this.user.findOne({ ...identifier, dateRegistered: { $exists: true } });
    if(user) {
      // FLOW: Update user auth token
      user = await this.user.findByIdAndUpdate(user._id, { googleAuthToken: googleAuthToken }, { new: true });
      return await this.sanitizeTokenResponse(user);
    } else {
      throw new UnrecognizedCredentialsException();
    }
  }

  public async sanitizeTokenResponse(user: (User & mongoose.Document)) {
    const authentication = await this.createToken(user._id, AccessType.auth, Number(process.env.AUTHENTICATION_EXPIRATION) * 7);
    return {
      authentication: authentication,
      user: user
    };
  }

  public async createToken(userId: mongoose.Types.ObjectId, auth: AccessType, expiration: number = Number(process.env.AUTHENTICATION_EXPIRATION)) {
    // FLOW: Check if authentication is already active
    let authentication = await this.authentication.findOne({ user: userId }).sort('-dateIssued');
    if(authentication && authentication.dateIssued.getTime() + authentication.expiration > (new Date()).getTime() + (1000 * 60 * 60 * expiration)) {
      try {
        jwt.verify(authentication.token, process.env.JWT_SECRET);
      } catch (err) {
        authentication = undefined;
      }
    } else {
      authentication = undefined;
    }

    // FLOW: If not, create one
    if(!authentication) {
      const authenticationTokenData: AuthenticationTokenData = {
        _id: userId.toString(),
        auth: auth
      };
      authentication = await this.authentication.create({
        user: userId,
        token: jwt.sign(authenticationTokenData, process.env.JWT_SECRET, { expiresIn: Number(Math.ceil(60 * 60 * expiration).toFixed(0)) }),
        expiration: 1000 * 60 * 60 * expiration
      });
    }

    // FLOW: Return authentication
    return authentication;
  }

  public static getInstance(): AuthenticationService {
    if(!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }
}

export default AuthenticationService;
