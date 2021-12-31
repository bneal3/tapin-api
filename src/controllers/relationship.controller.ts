import * as express from 'express';
import * as mongoose from 'mongoose';

import { Controller, RequestWithUser } from '../interfaces/index';
import { Relationship, RelationshipModel, CreateRelationshipDto, UserModel, User } from '../models/index';
import { BadParametersException, ServerProcessException, NotAuthorizedException, ObjectNotFoundException, HttpException } from '../utils/index';
import { logger } from '../utils/index';
import { admin, authorize, validation } from '../middleware/index';
import { relationshipService, userService } from '../services/index';

class RelationshipController implements Controller {
  public path = '/relationships';
  public router = express.Router();
  private relationship = RelationshipModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, authorize, this.get);
    this.router.post(`${this.path}`, authorize, validation(CreateRelationshipDto), this.post);
  }

  private get = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    try {
      const relationships = await relationshipService.getRelationships(request.user, request.query);
      response.send(relationships);
    } catch (err) {
      next(err);
    }
  }

  private post = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const createRelationshipData: CreateRelationshipDto = request.body;
    if((createRelationshipData.contactId && mongoose.Types.ObjectId.isValid(createRelationshipData.contactId)) || (createRelationshipData.email && createRelationshipData.name)) {
      try {
        const relationship = await relationshipService.createRelationship(request.user, createRelationshipData);
        response.send(relationship);
      } catch (err) {
        next(err);
      }
    } else {
      next(new BadParametersException());
    }
  }
}

export default RelationshipController;
