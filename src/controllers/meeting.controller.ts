import * as express from 'express';
import * as mongoose from 'mongoose';

import { HttpException, BadParametersException } from '../utils/index';
import { Controller, RequestWithUser } from '../interfaces/index';
import { admin, authorize, validation } from '../middleware/index';
import { CreateMeetingDto, EditMeetingDto } from '../models/index';
import { logger } from '../utils/index';
import { meetingService } from '../services/index';

class MeetingController implements Controller {
  public path = '/meetings';
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, authorize, this.get);
    this.router.post(`${this.path}`, authorize, validation(CreateMeetingDto), this.post);
    this.router.patch(`${this.path}/:id`, authorize, validation(EditMeetingDto), this.patch);
    this.router.delete(`${this.path}/:id`, authorize, this.delete);
  }

  private get = async (request: express.Request, response: express.Response, next: express.NextFunction) => {
    try {
      const meeting = await meetingService.getMeetings(request.query);
      response.send(meeting);
    } catch (err) {
      next(err);
    }
  }

  private post = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const createMeetingData: CreateMeetingDto = request.body;
    if(mongoose.Types.ObjectId.isValid(createMeetingData.recipientId)) {
      try {
        const meeting = await meetingService.createMeeting(request.user, createMeetingData);
        response.send(meeting);
      } catch (err) {
        next(err);
      }
    } else {
      next(new BadParametersException(`recipientId`, `not a valid id`));
    }
  }

  private patch = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    const editMeetingData: EditMeetingDto = request.body;
    if(mongoose.Types.ObjectId.isValid(request.params.id)) {
      try {
        const meeting = await meetingService.editMeeting(request.user, request.params.id, editMeetingData);
        response.send(meeting);
      } catch (err) {
        next(err);
      }
    } else {
      next(new BadParametersException(`id`, `not a valid id`));
    }
  }

  private delete = async (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    if(mongoose.Types.ObjectId.isValid(request.params.id)) {
      try {
        const meeting = await meetingService.deleteMeeting(request.user, request.params.id);
        response.send(meeting);
      } catch (err) {
        next(err);
      }
    } else {
      next(new BadParametersException(`id`, `not a valid id`));
    }
  }
}

export default MeetingController;
