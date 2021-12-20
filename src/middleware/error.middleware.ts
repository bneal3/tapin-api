import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../utils/exceptions';

function error(error: HttpException, request: Request, response: Response, next: NextFunction) {
  const status = error.status || 500;
  const message = error.message || 'Something went wrong';
  const meta = error.meta || {};

  response.status(status).send({
    status,
    message,
    meta,
  });
}

export default error;
