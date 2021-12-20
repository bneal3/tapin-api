import { HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException } from './exceptions';

import Cron from './cron';
import Google from './google';
import Logger from './logger'
import Sendinblue, { EmailSchedule } from './sendinblue';

const cron = Cron.getInstance();
const google = Google.getInstance();
const logger = Logger.getInstance();
const sendinblue = Sendinblue.getInstance();

export {
    cron, google, logger, HttpException, ServerProcessException, NotAuthorizedException, UnrecognizedCredentialsException, BadParametersException, ObjectAlreadyExistsException, ObjectNotFoundException, sendinblue, EmailSchedule
}
