import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';

const { OAuth2Client } = require('google-auth-library');

import { HttpException, ServerProcessException, BadParametersException, NotAuthorizedException, UnrecognizedCredentialsException, ObjectAlreadyExistsException, ObjectNotFoundException } from '../utils/index';
import { AccessType, AuthenticationTokenData } from '../interfaces/index';
import { AuthenticationModel, Authentication, SignInDto, MeetingModel, Meeting, RelationshipModel, Relationship, UserModel, User } from '../models/index';
import { analytics, logger } from '../utils/index';
import { userService } from '../services/index';

class AuthenticationService {
  private static instance: AuthenticationService;
  private authentication = AuthenticationModel;
  private meeting = MeetingModel;
  private relationship = RelationshipModel;
  private user = UserModel;

  public signIn = async (signInData: SignInDto) => {
    // FLOW: Create Google OAuth Client and verify auth code
    const client = new OAuth2Client(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET, process.env.REDIRECT_URIS.split(","));
    const payload = await this.verifyGoogleAuthCode(client, signInData.googleAuthCode);
    let contacts: (User & mongoose.Document)[] = await this.user.find({ email: payload.userInfo['email'] }).sort('dateCreated');
    if(contacts.length > 0 && contacts[0].dateRegistered) {
      // FLOW: Update refresh token if present
      if(payload.tokens.refresh_token) { contacts[0] = await this.user.findByIdAndUpdate(contacts[0]._id, { googleRefreshToken: payload.tokens.refresh_token }, { new: true }); }
      return await this.sanitizeTokenResponse(contacts[0]);
    } else {
      const userData: any = {
        googleId: payload.userInfo['sub'],
        googleRefreshToken: payload.tokens.refresh_token,
        email: payload.userInfo['email'],
        name: payload.userInfo['name']
      };
      try {
        const user = await this.user.create({
          ...userData,
          dateRegistered: Date.now()
        });
        if(contacts.length > 0) {
          // FLOW: Consolidate all contacts and delete them then point any relationships and meetings towards new user
          const updatedRelationships: any[] = [];
          const updatedMeetings: any[] = [];
          const deletedContacts: any[] = [];
          contacts.forEach(async (contact) => {
            const relationships = await this.relationship.find({ userIds: contact._id.toString() });
            relationships.forEach((relationship) => {
              const updatedRelationship = this.relationship.findByIdAndUpdate(relationship._id, {
                $pull: { userIds: contact._id.toString() },
                $push: { userIds: user._id.toString() }
              }, { new: true})
              updatedRelationships.push(updatedRelationship);
            });
            const meetings = await this.meeting.find({ recipient: contact._id });
            meetings.forEach((meeting) => {
              const updatedMeeting = this.meeting.findByIdAndUpdate(meeting._id, { recipient: user._id }, { new: true });
              updatedMeetings.push(updatedMeeting);
            });
            const deletedContact = this.user.findByIdAndDelete(contact._id);
            deletedContacts.push(deletedContact);
          });
          await Promise.all([updatedRelationships, updatedMeetings, deletedContacts]).then(() => {});
        }
        analytics.identify(user);
        analytics.track(user, `user signed in`);
        return await this.sanitizeTokenResponse(user);
      } catch (err) {
        throw new HttpException(400, err.message);
      }
    }
  }

  public verifyGoogleAuthCode = async (client: any, authCode: string) => {
    try {
      // FLOW: Get auth tokens from auth code
      const tokens = (await client.getToken(authCode)).tokens;
      // FLOW: Verify auth token and get googleId
      const userInfo = (await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_AUTH_CLIENT_ID
      })).getPayload();
      return { tokens, userInfo };
    } catch (err) {
      console.log(err);
      throw new UnrecognizedCredentialsException();
    }
  }

  public async sanitizeTokenResponse(user: (User & mongoose.Document)) {
    const authentication = await this.createToken(user._id, AccessType.Auth, Number(process.env.AUTHENTICATION_EXPIRATION) * 7);
    return {
      authentication: authentication,
      user: user
    };
  }

  public async createToken(userId: mongoose.Types.ObjectId, access: AccessType, expiration: number = Number(process.env.AUTHENTICATION_EXPIRATION)) {
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
        userId: userId.toString(),
        access: access
      };
      authentication = await this.authentication.create({
        user: userId,
        token: jwt.sign(authenticationTokenData, process.env.JWT_SECRET, { expiresIn: Number(Math.ceil(60 * 60 * expiration).toFixed(0)) }),
        access: access,
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
