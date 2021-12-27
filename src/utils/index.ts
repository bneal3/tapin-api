import * as mongoose from 'mongoose';

import { HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException } from './exceptions';

import Bull from './bull';
import Cron from './cron';
import Google from './google';
import Logger from './logger'
import Redis, { RedisPrefix } from './redis';
import Sendinblue, { EmailTemplate } from './sendinblue';

const bull = Bull.getInstance();
const cron = Cron.getInstance();
const google = Google.getInstance();
const logger = Logger.getInstance();
const redis = Redis.getInstance();
const sendinblue = Sendinblue.getInstance();

// Helper Functions
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useFindAndModify: false,
      useUnifiedTopology: true,
      useNewUrlParser: true
    });
  } catch (err) {
    Logger.getInstance().logger.error('Problem connecting to mongodb', { metadata: err });
  }
}

export {
    connectToDatabase, bull, cron, google, logger, HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException, redis, RedisPrefix, sendinblue, EmailTemplate
}
