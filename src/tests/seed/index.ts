import * as mongoose from 'mongoose';

import { AuthenticationModel, LogModel, MeetingModel, RelationshipModel, Relationship, UserModel, User } from '../../models/index';
import { authenticationService, meetingService, relationshipService, userService } from "../../services/index";
import { connectToDatabase, redis } from '../../utils/index';

const full: User = {
  _id: new mongoose.Types.ObjectId(),
  email: 'bengneal3@gmail.com',
  name: 'Benjamin Neal',
  dateCreated: new Date(),
  dateRegistered: new Date(),
};

const full2: User = {
  _id: new mongoose.Types.ObjectId(),
  email: 'the.ben.billion@gmail.com',
  name: 'Benjamin Neal',
  dateCreated: new Date(),
  dateRegistered: new Date(),
};

const shell: User = {
  _id: new mongoose.Types.ObjectId(),
  email: 'gettapinapp@gmail.com',
  name: 'TapIn App',
  dateCreated: new Date(),
}

const data = {
  full,
  full2,
  shell
};

async function resetDatabase() {
  if(process.env.NODE_ENV === 'test') {
    // FLOW: Connect to database(s) if not already
    if(mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) { await connectToDatabase(); }

    // FLOW: Remove all collections
    const removeAuthentications = AuthenticationModel.remove({});
    const removeLogs = LogModel.remove({});
    const removeMeetings = MeetingModel.remove({});
    const removeRelationships = RelationshipModel.remove({});
    const removeUsers = UserModel.remove({});
    await Promise.all([removeAuthentications, removeLogs, removeMeetings, removeRelationships, removeUsers]);

    // FLOW: Flush redis
    await new Promise((resolve, reject) => {
      redis.client.flushdb(function (err, success) {
        if(err) {
          reject(err);
        } else {
          resolve(success);
        }
      });
    });
  }
}

async function seedFullUser(user: User = data.full) {
  // TODO: Get proper google auth data
  const populate = {
    ...user
  }
  return await UserModel.create(populate);
}

async function seedShellUser() {
  return await UserModel.create(data.shell);
}

export {
  data, resetDatabase, seedFullUser, seedShellUser
}
