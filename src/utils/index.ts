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

export {
    bull, cron, google, logger, HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException, redis, RedisPrefix, sendinblue, EmailTemplate
}
