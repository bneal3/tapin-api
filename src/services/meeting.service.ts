import * as mongoose from 'mongoose';

import { HttpException, ObjectNotFoundException, BadParametersException, NotAuthorizedException, ServerProcessException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { MeetingModel, Meeting, MeetingStatus, CreateMeetingDto, EditMeetingDto, RelationshipModel, Relationship, UserModel, User } from '../models/index';
import { analytics, calendar, logger, email, EmailTemplate } from '../utils/index';
import { authenticationService, relationshipService } from '../services/index';

class MeetingService {
  private static instance: MeetingService;
  private meeting = MeetingModel;
  private relationship = RelationshipModel;
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
    if(query.initiators) {
      initiators = query.initiators.filter((initiator: string) => {
        if(mongoose.Types.ObjectId.isValid(initiator)) {
          return new mongoose.Types.ObjectId(initiator);
        }
      });
    }
    if(query.recipients) {
      recipients = query.recipients.filter((recipient: string) => {
        if(mongoose.Types.ObjectId.isValid(recipient)) {
          return new mongoose.Types.ObjectId(recipient);
        }
      });
    }
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
    const recipient = await this.user.findById(createMeetingData.recipientId);
    if(recipient) {
      createMeetingData.recipient = recipient;
      // FLOW: Create google calendar invite
      const client = await calendar.createClient(user.googleRefreshToken);
      const event = await calendar.createEvent(client, createMeetingData);
      // FLOW: Create object
      const meeting = await this.meeting.create({
        googleEventId: (<any>event).data.id,
        initiator: user._id,
        recipient: recipient._id,
        title: createMeetingData.title,
        dateStart: createMeetingData.dateStart,
        dateEnd: createMeetingData.dateEnd
      });
      // FLOW: Send email to recipient
      const emailData = await email.coreFormat(recipient, user, user._id);
      const formattedStartDate = email.formatDate(meeting.dateStart);
      const formattedEndDate = email.formatDate(meeting.dateEnd);
      const authentication = await authenticationService.createToken(recipient._id, AccessType.Single);
      await email.sendTemplateEmail(EmailTemplate.Invitation, [{ email: recipient.email , name: recipient.name }], {
        MEETINGID: meeting._id.toString(),
        FIRSTNAME: emailData.recipient.first,
        LASTNAME: emailData.recipient.last,
        FRIENDFIRST: emailData.friend.first,
        FRIENDLAST: emailData.friend.last,
        STARTTIME: formattedStartDate,
        ENDTIME: formattedEndDate,
        SCORE: emailData.scoreData.score,
        SCOREPOSITION: emailData.scoreData.position,
        SCOREPERCENTAGE: emailData.scoreData.percentage,
        TOKEN: authentication.token,
        APPURL: process.env.APP_URL,
        NOREPLYEMAIL: process.env.NOREPLY_EMAIL
      }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
      // FLOW: Return meeting
      analytics.track(user, `tap-in created`, {
        meetingId: meeting._id.toString()
      });
      return meeting;
    } else {
      throw new BadParametersException(`recipientId`, `it does not exist in the system`);
    }
  }

  public editMeeting = async (user: (User & mongoose.Document), _id: string, editMeetingData: EditMeetingDto) => {
    let meeting = await this.meeting.findById(_id);
    if(meeting) { // FLOW: If meeting exists
      const initiator = <User & mongoose.Document>(await meeting.populate('initiator').execPopulate()).initiator;
      const recipient = <User & mongoose.Document>(await meeting.populate('recipient').execPopulate()).recipient;
      if(initiator._id.equals(user._id) || recipient._id.equals(user._id)) { // FLOW: Is editing user a part of the meeting
        const editMeetingObject: any = {};
        // FLOW: status
        if(editMeetingData.status) {
          if(initiator._id.equals(user._id)) {
            if(meeting.dateEnd.getTime() > Date.now()) {
              if(editMeetingData.status === MeetingStatus.Canceled) {
                const client = await calendar.createClient(user.googleRefreshToken);
                await calendar.cancelEvent(client, meeting.googleEventId);
                // FLOW: Send cancelation email
                const emailData = await email.coreFormat(recipient, user, user._id);
                const formattedStartDate = email.formatDate(meeting.dateStart);
                const formattedEndDate = email.formatDate(meeting.dateEnd);
                await email.sendTemplateEmail(EmailTemplate.Canceled, [{ email: recipient.email , name: recipient.name }], {
                  FIRSTNAME: emailData.recipient.first,
                  LASTNAME: emailData.recipient.last,
                  FRIENDFIRST: emailData.friend.first,
                  FRIENDLAST: emailData.friend.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  SCORERELATION: 'your',
                  APPURL: process.env.APP_URL,
                  NOREPLYEMAIL: process.env.NOREPLY_EMAIL
                }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
              } else {
                throw new BadParametersException(`status`, `the current status does not allow for that change`);
              }
            } else {
              throw new BadParametersException(`status`, `this meeting has expired`);
            }
          } else {
            if(meeting.dateEnd.getTime() > Date.now()) { // FLOW: Can only Accept, Reject or Cancel if dateEnd is greater than now
              if(editMeetingData.status === MeetingStatus.Accepted && (meeting.status === MeetingStatus.Pending || meeting.status === MeetingStatus.Rejected)) { // FLOW: If status is edited to Accepted, edit gcal invite to reflect this
                if(user.dateRegistered) {
                  const client = await calendar.createClient(user.googleRefreshToken);
                  await calendar.updateEvent(client, meeting.googleEventId, {
                    attendees: [
                      {
                        email: user.email,
                        responseStatus: 'accepted'
                      }
                    ]
                  });
                }
                // FLOW: Send email to initiator that recipient accepted invite
                const emailData = await email.coreFormat(initiator, user, initiator._id);
                const formattedStartDate = email.formatDate(meeting.dateStart);
                const formattedEndDate = email.formatDate(meeting.dateEnd);
                await email.sendTemplateEmail(EmailTemplate.Accepted, [{ email: initiator.email, name: initiator.name }], {
                  FIRSTNAME: emailData.recipient.first,
                  LASTNAME: emailData.recipient.last,
                  FRIENDFIRST: emailData.friend.first,
                  FRIENDLAST: emailData.friend.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  APPURL: process.env.APP_URL,
                  NOREPLYEMAIL: process.env.NOREPLY_EMAIL
                }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
                // FLOW: Queue followup emails after the event
                const delay = (meeting.dateEnd.getTime() - (new Date()).getTime()) + Number(process.env.POST_EVENT_EMAIL_DELAY);
                // FLOW: Initiator follow up
                const initiatorAuth = await authenticationService.createToken(initiator._id, AccessType.Single);
                await email.queueEmail({ templateId: EmailTemplate.PostEvent, to: [{ email: initiator.email, name: initiator.name }], params: {
                  MEETINGID: meeting._id.toString(),
                  FIRSTNAME: emailData.recipient.first,
                  LASTNAME: emailData.recipient.last,
                  FRIENDFIRST: emailData.friend.first,
                  FRIENDLAST: emailData.friend.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  SCORERELATION: 'your',
                  TOKEN: initiatorAuth.token,
                  APPURL: process.env.APP_URL
                }, sender: { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL }, meetingId: meeting._id.toString(), dateEnd: meeting.dateEnd }, { delay: delay });
                // FLOW: Recipient follow up
                const recipientAuth = await authenticationService.createToken(user._id, AccessType.Single);
                await email.queueEmail({ templateId: EmailTemplate.PostEvent, to: [{ email: user.email, name: user.name }], params: {
                  MEETINGID: meeting._id.toString(),
                  FIRSTNAME: emailData.friend.first,
                  LASTNAME: emailData.friend.last,
                  FRIENDFIRST: emailData.recipient.first,
                  FRIENDLAST: emailData.recipient.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  SCORERELATION: 'their',
                  TOKEN: recipientAuth.token,
                  APPURL: process.env.APP_URL
                }, sender: { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL }, meetingId: meeting._id.toString(), dateEnd: meeting.dateEnd }, { delay: delay });
                // FLOW: Update relationship score
                const relationship = await this.relationship.findOne({ userIds: [initiator._id.toString(), user._id.toString()] });
                await this.relationship.findByIdAndUpdate(relationship._id, { score: relationship.score + 20 }, { new: true });
              } else if(editMeetingData.status === MeetingStatus.Rejected && (meeting.status === MeetingStatus.Pending || meeting.status === MeetingStatus.Accepted)) { // FLOW: If status is edited to Happened, increase ShipScore for rank/add new rank if one does not already exist
                if(user.dateRegistered) {
                  const client = await calendar.createClient(user.googleRefreshToken);
                  await calendar.updateEvent(client, meeting.googleEventId, {
                    attendees: [
                      {
                        email: user.email,
                        responseStatus: 'declined'
                      }
                    ]
                  });
                }
                // FLOW: Send Rejection email
                const emailData = await email.coreFormat(initiator, user, initiator._id);
                const formattedStartDate = email.formatDate(meeting.dateStart);
                const formattedEndDate = email.formatDate(meeting.dateEnd);
                await email.sendTemplateEmail(EmailTemplate.Rejected, [{ email: initiator.email, name: initiator.name }], {
                  FIRSTNAME: emailData.recipient.first,
                  LASTNAME: emailData.recipient.last,
                  FRIENDFIRST: emailData.friend.first,
                  FRIENDLAST: emailData.friend.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  APPURL: process.env.APP_URL,
                  NOREPLYEMAIL: process.env.NOREPLY_EMAIL
                }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
              } else if(editMeetingData.status == MeetingStatus.Canceled && meeting.status !== MeetingStatus.Pending) {
                if(user.dateRegistered) {
                  const client = await calendar.createClient(user.googleRefreshToken);
                  await calendar.updateEvent(client, meeting.googleEventId, {
                    attendees: [
                      {
                        email: user.email,
                        responseStatus: 'declined'
                      }
                    ]
                  });
                }
                // FLOW: Send cancelation email
                const emailData = await email.coreFormat(user, recipient, user._id);
                const formattedStartDate = email.formatDate(meeting.dateStart);
                const formattedEndDate = email.formatDate(meeting.dateEnd);
                await email.sendTemplateEmail(EmailTemplate.Canceled, [{ email: recipient.email, name: recipient.name }], {
                  FIRSTNAME: emailData.recipient.first,
                  LASTNAME: emailData.recipient.last,
                  FRIENDFIRST: emailData.friend.first,
                  FRIENDLAST: emailData.friend.last,
                  STARTTIME: formattedStartDate,
                  ENDTIME: formattedEndDate,
                  SCORE: emailData.scoreData.score,
                  SCOREPOSITION: emailData.scoreData.position,
                  SCOREPERCENTAGE: emailData.scoreData.percentage,
                  SCORERELATION: 'their',
                  APPURL: process.env.APP_URL,
                  NOREPLYEMAIL: process.env.NOREPLY_EMAIL
                }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
              } else {
                throw new BadParametersException(`status`, `the current status does not allow for that change`);
              }
            } else {
              throw new BadParametersException(`status`, `this meeting has expired`)
            }
          }
        }
        // FLOW: title
        if(editMeetingData.title) {
          if(!initiator._id.equals(user._id)) {
            throw new BadParametersException(`title`, `editing user is not the initiator`);
          }
        }
        // FLOW: timeStart & timeEnd
        if(editMeetingData.timeStart || editMeetingData.timeEnd) {
          if(initiator._id.equals(user._id)) {
            if(meeting.status !== MeetingStatus.Canceled && meeting.dateEnd.getTime() > Date.now()) {
              let dateStart = meeting.dateStart;
              let dateEnd = meeting.dateEnd;
              if(editMeetingData.timeStart) {
                editMeetingData.dateStart = new Date(editMeetingData.timeStart);
                dateStart = editMeetingData.dateStart;
              }
              if(editMeetingData.timeEnd) {
                editMeetingData.dateEnd = new Date(editMeetingData.timeEnd);
                dateEnd = editMeetingData.dateEnd;
              }
              // FLOW: Send email to recipient if not happened already (status is pending or accepted and now is before previous start time)
              const emailData = await email.coreFormat(recipient, user, user._id);
              const formattedStartDate = email.formatDate(dateStart);
              const formattedEndDate = email.formatDate(dateEnd);
              const authentication = await authenticationService.createToken(recipient._id, AccessType.Single);
              await email.sendTemplateEmail(EmailTemplate.Updated, [{ email: recipient.email , name: recipient.name }], {
                MEETINGID: meeting._id.toString(),
                FIRSTNAME: emailData.recipient.first,
                LASTNAME: emailData.recipient.last,
                FRIENDFIRST: emailData.friend.first,
                FRIENDLAST: emailData.friend.last,
                STARTTIME: formattedStartDate,
                ENDTIME: formattedEndDate,
                SCORE: emailData.scoreData.score,
                SCOREPOSITION: emailData.scoreData.position,
                SCOREPERCENTAGE: emailData.scoreData.percentage,
                TOKEN: authentication.token,
                APPURL: process.env.APP_URL,
                NOREPLYEMAIL: process.env.NOREPLY_EMAIL
              }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
              // FLOW: Set meeting status to pending
              editMeetingData.status = MeetingStatus.Pending;
            } else {
              throw new BadParametersException(`dateStart or dateEnd`, `meeting is either canceled or dateEnd has passed`);
            }
          } else {
            throw new BadParametersException(`dateStart or dateEnd`, `editing user is not the initiator`);
          }
        }
        // FLOW: confirmed
        if(editMeetingData.confirmed) {
          if((meeting.status === MeetingStatus.Pending || meeting.status === MeetingStatus.Accepted) && meeting.dateEnd.getTime() < Date.now()) {
            if(!meeting.confirmed.includes(user._id.toString())) {
              // FLOW: Check if other user has already confirmed, if so change status to happened
              if(meeting.confirmed.length === 1) { editMeetingData.status = MeetingStatus.Happened; }
              // FLOW: Update relationship score
              const relationship = await this.relationship.findOne({ userIds: [initiator._id.toString(), recipient._id.toString()] });
              await this.relationship.findByIdAndUpdate(relationship._id, { score: relationship.score + 40 }, { new: true });
              // FLOW: Add to editMeetingObject
              Object.assign(editMeetingObject, { $push: { confirmed: user._id.toString() }});
              if(initiator._id.isEqual(user._id)) {
                analytics.track(user, `initiator confirmed tap-in`, {
                  meetingId: meeting._id.toString()
                });
              } else {
                analytics.track(user, `recipient confirmed tap-in`, {
                  meetingId: meeting._id.toString()
                });
              }
              delete editMeetingData.confirmed;
            } else {
              throw new BadParametersException(`confirmed`, `editing user has already confirmed`);
            }
          } else {
            throw new BadParametersException(`confirmed`, `status is not Pending or Accepted or it isn't after dateEnd yet`);
          }
        }
        // FLOW: Status update catch all
        if(editMeetingData.status) {
          editMeetingData.dateStatusLastUpdated = new Date();
          if(editMeetingData.status === MeetingStatus.Accepted) {
            analytics.track(user, `tap-in accepted`, {
              meetingId: meeting._id.toString()
            });
          } else if(editMeetingData.status === MeetingStatus.Happened) {
            analytics.track(user, `tap-in happened`, {
              meetingId: meeting._id.toString()
            });
          }
        }
        // FLOW: Merge editMeetingData into editMeetingObject which is general object
        Object.assign(editMeetingObject, editMeetingData);
        // FLOW: Update meeting
        meeting = await this.meeting.findByIdAndUpdate(meeting._id, editMeetingObject, { new: true });
        // FLOW: Return meeting
        return meeting;
      } else {
        throw new NotAuthorizedException();
      }
    } else {
      throw new BadParametersException(`id`, 'it does not exist in the system');
    }
  }

  public deleteMeeting = async (user: (User & mongoose.Document), _id: string) => {
    const meeting = await this.meeting.findById(_id);
    if(meeting) {
      const initiator = <User & mongoose.Document>(await meeting.populate('initiator').execPopulate()).initiator;
      const recipient = <User & mongoose.Document>(await meeting.populate('recipient').execPopulate()).recipient;
      if(initiator._id.equals(user._id)) {
        // FLOW: Delete gcal event
        const client = await calendar.createClient(user.googleRefreshToken);
        await calendar.cancelEvent(client, meeting.googleEventId);
        // FLOW: Send cancelation email
        const emailData = await email.coreFormat(recipient, user, user._id);
        const formattedStartDate = email.formatDate(meeting.dateStart);
        const formattedEndDate = email.formatDate(meeting.dateEnd);
        await email.sendTemplateEmail(EmailTemplate.Canceled, [{ email: recipient.email , name: recipient.name }], {
          FIRSTNAME: emailData.recipient.first,
          LASTNAME: emailData.recipient.last,
          FRIENDFIRST: emailData.friend.first,
          FRIENDLAST: emailData.friend.last,
          STARTTIME: formattedStartDate,
          ENDTIME: formattedEndDate,
          SCORE: emailData.scoreData.score,
          SCOREPOSITION: emailData.scoreData.position,
          SCOREPERCENTAGE: emailData.scoreData.percentage,
          SCORERELATION: 'your',
          APPURL: process.env.APP_URL,
          NOREPLYEMAIL: process.env.NOREPLY_EMAIL
        }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
        // FLOW: Delete object
        return this.meeting.findByIdAndDelete(meeting._id);
      } else {
        throw new NotAuthorizedException();
      }
    } else {
      throw new BadParametersException(`id`, `it does not exist in the system`);
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
