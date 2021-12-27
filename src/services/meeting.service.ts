import * as mongoose from 'mongoose';

import { HttpException, ObjectNotFoundException, BadParametersException, UnrecognizedCredentialsException, ServerProcessException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { MeetingModel, Meeting, MeetingStatus, CreateMeetingDto, EditMeetingDto, ScoreModel, Score, UserModel, User } from '../models/index';
import { google, logger, sendinblue, EmailTemplate } from '../utils/index';
import { authenticationService, scoreService } from '../services/index';

class MeetingService {
  private static instance: MeetingService;
  private meeting = MeetingModel;
  private score = ScoreModel;
  private user = UserModel;

  public getMeetings = async (query: any) => {
    let ids: string[] = query.ids ?? [];
    let initiators: mongoose.Schema.Types.ObjectId[] = [];
    let recipients: mongoose.Schema.Types.ObjectId[] = [];
    ids = ids.filter((id) => {
      if(mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
    });
    initiators = query.initiators.filter((initiator: string) => {
      if(mongoose.Types.ObjectId.isValid(initiator)) {
        return new mongoose.Schema.Types.ObjectId(initiator);
      }
    });
    recipients = query.recipients.filter((recipient: string) => {
      if(mongoose.Types.ObjectId.isValid(recipient)) {
        return new mongoose.Schema.Types.ObjectId(recipient);
      }
    });
    // FLOW: Get users
    const meetings = await this.meeting.find({
      $or: [
        { _id: { $in: ids }},
        { initiator: { $in: initiators }},
        { recipient: { $in: recipients }}
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
          name: createMeetingData.name,
          referrer: user._id
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

    // FLOW: Send email to recipient
    const authentication = await authenticationService.createToken(recipient._id, AccessType.auth, Number(process.env.AUTHENTICATION_EXPIRATION) * 3);
    await sendinblue.sendTemplateEmail(EmailTemplate.Invitation, [{ email: recipient.email , name: recipient.name }], { FIRSTNAME: recipient.name.split(' ')[0], APPURL: process.env.APP_URL, _SI: authentication._si }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });

    // FLOW: Return meeting
    return meeting;
  }

  public editMeeting = async (user: (User & mongoose.Document), _id: string, editMeetingData: EditMeetingDto) => {
    let meeting = await this.meeting.findById(_id);
    if(meeting) { // FLOW: If meeting exists
      if(meeting.initiator === user._id || meeting.recipient === user._id) { // FLOW: Is editing user a part of the meeting
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
            // FLOW: Send email to initiator that recipient accepted invite
            const authentication = await authenticationService.createToken(user._id, AccessType.auth, Number(process.env.AUTHENTICATION_EXPIRATION) * 3);
            await sendinblue.sendTemplateEmail(EmailTemplate.Accepted, [{ email: user.email , name: user.name }], { FIRSTNAME: user.name.split(' ')[0], APPURL: process.env.APP_URL, _SI: authentication._si }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
            // FLOW: Queue followup email after the event
            const delay = (meeting.dateEnd.getTime() - (new Date()).getTime()) + Number(process.env.POST_EVENT_EMAIL_DELAY);
            await sendinblue.queueEmail({ templateId: EmailTemplate.PostEvent, to: [{ email: user.email , name: user.name }], params: { FIRSTNAME: user.name.split(' ')[0], APPURL: process.env.APP_URL, _SI: authentication._si }, sender: { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL }, user: user }, { delay: delay });
          } else if(editMeetingData.status === MeetingStatus.Happened) { // FLOW: If status is edited to Happened, increase score for rank/add new rank if one does not already exist
            let score = await this.score.findOne({
              source: user._id,
              target: (<User & mongoose.Document>meeting.recipient)._id
            });
            if(!score) { score = await scoreService.createScore({ source: user, target: (<User & mongoose.Document>meeting.recipient) }); }
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
        throw new UnrecognizedCredentialsException();
      }
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
