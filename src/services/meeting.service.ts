import * as mongoose from 'mongoose';

import { HttpException, ObjectNotFoundException, BadParametersException, ServerProcessException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { MeetingModel, Meeting, CreateMeetingDto, EditMeetingDto, UserModel, User } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService, userService } from '../services/index';

class MeetingService {
  private static instance: MeetingService;
  private meeting = MeetingModel;
  private user = UserModel;

  public getMeetings = async (query: any) => {
    const initiatorId = query.initiatorId;
    const recipientId = query.recipientId;
    if(initiatorId && recipientId) {
      const meeting = await this.meeting.findOne({ initiator: initiatorId, recipient: recipientId, dateCreated: { $exists: true } }).sort('-dateCreated');
      if(meeting) {
        return meeting;
      } else {
        throw new ObjectNotFoundException('meeting');
      }
    } else {
      throw new BadParametersException();
    }
  }

  // FUNCTION: Extract payment information from checkout session object and update user and customer models
  public createMeeting = async (user: (User & mongoose.Document), createMeetingData: CreateMeetingDto) => {

  }

  public editMeeting = async (user: (User & mongoose.Document), _id: string, editMeetingData: EditMeetingDto) => {

  }

  public static getInstance(): MeetingService {
    if (!MeetingService.instance) {
      MeetingService.instance = new MeetingService();
    }
    return MeetingService.instance;
  }
}

export default MeetingService;
