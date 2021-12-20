// @ts-ignore
import { plainToClass } from 'class-transformer';
// @ts-ignore
import { validate, ValidationError } from 'class-validator';
import * as express from 'express';
import { HttpException } from '../utils/exceptions';

function validation<T>(type: any, skipMissingProperties = false): express.RequestHandler {
  return (request, response, next) => {
    validate(plainToClass(type, request.body), { skipMissingProperties }).then((errors: ValidationError[]) => {
      if (errors.length > 0) {
        const message = errors.map((error: ValidationError) => Object.values(error.constraints)).join(', ');
        next(new HttpException(400, message));
      } else {
        next();
      }
    });
  };
}

export default validation;
