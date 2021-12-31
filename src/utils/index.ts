import * as mongoose from 'mongoose';

import { HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException, ServiceDependencyException } from './exceptions';

import Bull from './bull';
import Calendar from './calendar';
import Cron from './cron';
import Email, { EmailTemplate } from './email';
import Logger from './logger'
import Redis, { RedisPrefix } from './redis';

const bull = Bull.getInstance();
const calendar = Calendar.getInstance();
const cron = Cron.getInstance();
const email = Email.getInstance();
const logger = Logger.getInstance();
const redis = Redis.getInstance();

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
    bull, calendar, cron, email, EmailTemplate, logger, redis, RedisPrefix, connectToDatabase, HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException, ServiceDependencyException
}
