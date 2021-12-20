import * as mongoose from 'mongoose';

import { HttpException, ObjectNotFoundException, BadParametersException, ServerProcessException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { MeetingModel, Meeting, MeetingStatus, CreateMeetingDto, EditMeetingDto, ScoreModel, Score, UserModel, User } from '../models/index';
import { google, logger } from '../utils/index';
import { scoreService } from '../services/index';

class MeetingService {
  private static instance: MeetingService;
  private meeting = MeetingModel;
  private score = ScoreModel;
  private user = UserModel;

  public getMeetings = async (query: any) => {
    let ids: string[] = query.ids ?? [];
    let initiatorId: string = query.initiatorId ?? '';
    let recipientId: string = query.recipientId ?? '';
    ids = ids.filter((id) => {
      if(mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
    });
    // FLOW: Get users
    const meetings = await this.meeting.find({
      $or: [
        { _id: { $in: ids }},
        { initiator: mongoose.Types.ObjectId(initiatorId) },
        { recipient: mongoose.Types.ObjectId(recipientId) }
      ]
    }).catch((err: Error) => { return undefined; });
    if(meetings) {
      return meetings;
    } else {
      throw new ObjectNotFoundException('identifier(s)');
    }
  }

  public createMeeting = async (user: (User & mongoose.Document), createMeetingData: CreateMeetingDto) => {
    createMeetingData.dateStart = new Date(createMeetingData.timeStart);
    createMeetingData.dateEnd = new Date(createMeetingData.timeEnd);
    let recipient = await this.user.findById(createMeetingData.recipientId);
    if(!recipient) {
      if(createMeetingData.email && createMeetingData.name) {
        // FLOW: Create new user
        recipient = await this.user.create({
          email: createMeetingData.email,
          name: createMeetingData.name
        });
      } else {
        throw new BadParametersException();
      }
    }
    createMeetingData.recipient = recipient;

    // FLOW: Create google calendar invite
    const client = await google.createClient(user.googleAuthToken);
    const event = await google.createEvent(client, createMeetingData);

    // FLOW: Create object
    const meeting = await this.meeting.create({
      googleEventId: (<any>event).id,
      initiator: user._id,
      recipient: recipient._id,
      title: createMeetingData.title,
      dateMeeting: createMeetingData.dateStart,
      dateEnd: createMeetingData.dateEnd
    });

    // TODO: Send email to recipient
    // TODO: Queue followup email after the event

    // FLOW: Return meeting
    return meeting;
  }

  public editMeeting = async (user: (User & mongoose.Document), _id: string, editMeetingData: EditMeetingDto) => {
    let meeting = await this.meeting.findById(_id);
    if(meeting) { // FLOW: If meeting exists
      await meeting.populate('recipient').execPopulate();
      if(editMeetingData.status) {
        if(editMeetingData.status === MeetingStatus.Accepted) { // FLOW: If status is edited to Accepted, edit gcal invite to reflect this
          const client = await google.createClient(user.googleAuthToken);
          await google.updateEvent(client, meeting.googleEventId, {
            attendees: [
              {
                email: (<User>meeting.recipient).email,
                responseStatus: 'accepted'
              }
            ]
          });
          // TODO: Send email to initiator that recipient accepted invite
        } else if(editMeetingData.status === MeetingStatus.Happened) { // FLOW: If status is edited to Happened, increase score for rank/add new rank if one does not already exist
          let score = await this.score.findOne({
            source: user._id,
            target: (<User & mongoose.Document>meeting.recipient)._id
          });
          if(!score) { score = await scoreService.createScore({ target: (<User & mongoose.Document>meeting.recipient) }); }
          await scoreService.updateScore(score._id, { value: score.value + 1 });
        } else if(editMeetingData.status === MeetingStatus.Canceled) { // FLOW: Delete gcal event
          const client = await google.createClient(user.googleAuthToken);
          await google.cancelEvent(client, meeting.googleEventId);
        }
        editMeetingData.dateStatusLastUpdated = new Date();
      } else {
        delete editMeetingData.status;
      }
      if(editMeetingData.dayStatusLastUpdated) { editMeetingData.dateStatusLastUpdated = new Date(editMeetingData.dayStatusLastUpdated); }
      meeting = await this.meeting.findByIdAndUpdate(meeting._id, editMeetingData, { new: true });
      return meeting;
    } else {
      throw new BadParametersException();
    }
  }

  public deleteMeeting = async (user: (User & mongoose.Document), _id: string) => {
    const meeting = await this.meeting.findById(_id);
    if(meeting) {
      // FLOW: Delete gcal event
      const client = await google.createClient(user.googleAuthToken);
      await google.cancelEvent(client, meeting.googleEventId);
      // FLOW: Delete object
      return this.meeting.findByIdAndDelete(meeting._id);
    } else {
      throw new BadParametersException();
    }
  }

  public static getInstance(): MeetingService {
    if (!MeetingService.instance) {
      MeetingService.instance = new MeetingService();
    }
    return MeetingService.instance;
  }
}

export default MeetingService;
