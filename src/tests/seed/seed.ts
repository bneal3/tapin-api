import * as mongoose from 'mongoose';
import * as shortid from 'shortid';
import * as bcrypt from 'bcryptjs';
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).argv;

import { AuthenticationModel, LogModel, MeetingModel, ScoreModel, Score, UserModel, User } from '../../models/index';
import { authenticationService, meetingService, scoreService, userService } from "../../services/index";
import { connectToDatabase, redis } from '../../utils/index';

import { data, resetDatabase, seedFullUser, seedShellUser } from './index';

// TODO: 3 users, 2 full, 1 shell; 3 meetings (2 between full, 1 between full and shell); 2 scores
(async () => {
  // FLOW: Reset database
  await resetDatabase();

  // FLOW: Create users

  // FLOW: Create meetings

  // FLOW: Create scores
});
