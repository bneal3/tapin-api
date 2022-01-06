import Logger from './logger';

class HttpException extends Error {
  public status: number;
  public message: string;
  public meta?: any;

  constructor(status: number, message: string, meta?: any) {
    super(message);
    this.status = status;
    this.message = message;
    this.meta = meta;
  }
}

class UnrecognizedCredentialsException extends HttpException {
  constructor() {
    super(401, 'Unrecognized authentication credentials');
  }
}

class NotAuthorizedException extends HttpException {
  constructor() {
    super(401, 'Not authorized');
  }
}

class ObjectNotFoundException extends HttpException {
  constructor(object: string) {
    super(404, `That ${object} could not be found`);
  }
}

class ObjectAlreadyExistsException extends HttpException {
  constructor(object: string, field: string) {
    super(409, `${object} with that ${field} already exists`);
  }
}

class BadParametersException extends HttpException {
  constructor(field: string, message: string) {
    super(422, `Couldn\'t process ${field} because ${message}`);
  }
}

class ServerProcessException extends HttpException {
  constructor(message: string, meta?: any) {
    super(500, message, meta);

    const metadata = meta || {};
    Logger.getInstance().logger.error(message, { metadata });
  }
}


class ServiceDependencyException extends HttpException {
  constructor() {
    super(511, `Additional service authentication required`);
  }
}

export {
    HttpException, ServerProcessException, BadParametersException, UnrecognizedCredentialsException, NotAuthorizedException, ObjectNotFoundException, ObjectAlreadyExistsException, ServiceDependencyException
}
