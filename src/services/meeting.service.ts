import * as mongoose from 'mongoose';

import { HttpException, ObjectNotFoundException, BadParametersException, UnrecognizedCredentialsException, ServerProcessException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { MeetingModel, Meeting, MeetingStatus, CreateMeetingDto, EditMeetingDto, RelationshipModel, Relationship, UserModel, User } from '../models/index';
import { calendar, logger, email, EmailTemplate } from '../utils/index';
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
    let recipient = await this.user.findById(createMeetingData.recipientId);
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
      const userNames = email.formatNames(user.name);
      const recipientNames = email.formatNames(recipient.name);
      const relationships = await this.relationship.find({ userIds: user._id.toString() });
      const relationship = relationships.filter((relationship) => { return relationship.userIds.includes(recipient._id.toString()); })[0];
      const score = email.formatScore(relationships, relationship._id);
      const formattedStartDate = email.formatDate(meeting.dateStart);
      const formattedEndDate = email.formatDate(meeting.dateEnd);
      await email.sendTemplateEmail(EmailTemplate.Invitation, [{ email: recipient.email , name: recipient.name }], {
        FIRSTNAME: recipientNames.first,
        LASTNAME: recipientNames.last,
        FRIENDFIRST: userNames.first,
        FRIENDLAST: userNames.last,
        STARTTIME: formattedStartDate,
        ENDTIME: formattedEndDate,
        SCORE: relationship.score,
        SCOREPOSITION: score.position,
        SCOREPERCENTAGE: score.percentage,
        APPURL: process.env.APP_URL
      }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
      // FLOW: Return meeting
      return meeting;
    } else {
      throw new BadParametersException();
    }
  }

  public editMeeting = async (_id: string, editMeetingData: EditMeetingDto) => {
    let meeting = await this.meeting.findById(_id);
    if(meeting) { // FLOW: If meeting exists
      if(meeting.initiator.toString() === editMeetingData.userId || meeting.recipient.toString() === editMeetingData.userId) { // FLOW: Is editing user a part of the meeting
        const editMeetingObject: any = {};
        await meeting.populate('initiator').execPopulate();
        await meeting.populate('recipient').execPopulate();
        if((<User & mongoose.Document>meeting.initiator)._id === editMeetingData.userId) {
          if(editMeetingData.timeStart) { editMeetingData.dateStart = new Date(editMeetingData.timeStart); }
          if(editMeetingData.timeEnd) { editMeetingData.dateEnd = new Date(editMeetingData.timeEnd); }
        } else {
          if(editMeetingData.title) { delete editMeetingData.title; }
        }
        if(editMeetingData.confirmed && (meeting.status === MeetingStatus.Pending || meeting.status === MeetingStatus.Accepted)) {
          if(!meeting.confirmed.includes(editMeetingData.userId)) {
            // FLOW: Check if other user has already confirmed, if so change status to happened
            if(meeting.confirmed.length === 1) { editMeetingData.status = MeetingStatus.Happened; }
            // FLOW: Update relationship score
            const relationship = await this.relationship.findOne({ userIds: [(<User & mongoose.Document>meeting.initiator)._id.toString(), (<User & mongoose.Document>meeting.recipient)._id.toString()] });
            await this.relationship.findByIdAndUpdate(relationship._id, { score: relationship.score + 40 }, { new: true });
            // FLOW: Add to editMeetingObject
            Object.assign(editMeetingObject, { $push: { confirmed: editMeetingData.userId }});
            delete editMeetingData.confirmed;
          }
        }
        if(editMeetingData.status) {
          if((<User & mongoose.Document>meeting.initiator)._id === editMeetingData.userId) {
            if(editMeetingData.status === MeetingStatus.Canceled) {
              const client = await calendar.createClient((<User & mongoose.Document>meeting.initiator).googleRefreshToken);
              await calendar.cancelEvent(client, meeting.googleEventId);
              // FLOW: Send cancelation email
              const userNames = email.formatNames((<User & mongoose.Document>meeting.recipient).name);
              const recipientNames = email.formatNames((<User & mongoose.Document>meeting.initiator).name);
              const relationships = await this.relationship.find({ userIds: (<User & mongoose.Document>meeting.initiator)._id });
              const relationship = relationships.filter((relationship) => { return relationship.userIds.includes((<User & mongoose.Document>meeting.recipient)._id.toString()); })[0];
              const score = email.formatScore(relationships, relationship._id);
              await email.sendTemplateEmail(EmailTemplate.Invitation, [{ email: (<User & mongoose.Document>meeting.recipient).email , name: (<User & mongoose.Document>meeting.recipient).name }], {
                FIRSTNAME: userNames.first,
                LASTNAME: userNames.last,
                FRIENDFIRST: recipientNames.first,
                FRIENDLAST: recipientNames.last,
                SCORE: relationship.score,
                SCOREPOSITION: score.position,
                SCOREPERCENTAGE: score.percentage,
                APPURL: process.env.APP_URL
              }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
            }
          } else {
            if(editMeetingData.status === MeetingStatus.Accepted) { // FLOW: If status is edited to Accepted, edit gcal invite to reflect this
              if((<User & mongoose.Document>meeting.recipient).dateRegistered) {
                const client = await calendar.createClient((<User & mongoose.Document>meeting.recipient).googleRefreshToken);
                await calendar.updateEvent(client, meeting.googleEventId, {
                  attendees: [
                    {
                      email: (<User & mongoose.Document>meeting.recipient).email,
                      responseStatus: 'accepted'
                    }
                  ]
                });
              }
              // FLOW: Send email to initiator that recipient accepted invite
              const userNames = email.formatNames((<User & mongoose.Document>meeting.initiator).name);
              const recipientNames = email.formatNames((<User & mongoose.Document>meeting.recipient).name);
              const relationships = await this.relationship.find({ userIds: (<User & mongoose.Document>meeting.initiator)._id });
              const relationship = relationships.filter((relationship) => { return relationship.userIds.includes((<User & mongoose.Document>meeting.recipient)._id.toString()); })[0];
              const score = email.formatScore(relationships, relationship._id);
              await email.sendTemplateEmail(EmailTemplate.Accepted, [{ email: (<User & mongoose.Document>meeting.initiator).email, name: (<User & mongoose.Document>meeting.initiator).name }], {
                FIRSTNAME: userNames.first,
                LASTNAME: userNames.last,
                FRIENDFIRST: recipientNames.first,
                FRIENDLAST: recipientNames.last,
                SCORE: relationship.score,
                SCOREPOSITION: score.position,
                SCOREPERCENTAGE: score.percentage,
                APPURL: process.env.APP_URL
              }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
              // FLOW: Queue followup email after the event
              const delay = (meeting.dateEnd.getTime() - (new Date()).getTime()) + Number(process.env.POST_EVENT_EMAIL_DELAY);
              await email.queueEmail({ templateId: EmailTemplate.PostEvent, to: [{ email: (<User & mongoose.Document>meeting.initiator).email, name: (<User & mongoose.Document>meeting.initiator).name }], params: {
                FIRSTNAME: userNames.first,
                LASTNAME: userNames.last,
                FRIENDFIRST: recipientNames.first,
                FRIENDLAST: recipientNames.last,
                SCORE: relationship.score,
                SCOREPOSITION: score.position,
                SCOREPERCENTAGE: score.percentage,
                SCORERELATION: 'your',
                APPURL: process.env.APP_URL
              }, sender: { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL }, user: (<User & mongoose.Document>meeting.initiator) }, { delay: delay });
              await email.queueEmail({ templateId: EmailTemplate.PostEvent, to: [{ email: (<User & mongoose.Document>meeting.recipient).email, name: (<User & mongoose.Document>meeting.recipient).name }], params: {
                FIRSTNAME: recipientNames.first,
                LASTNAME: recipientNames.last,
                FRIENDFIRST: userNames.first,
                FRIENDLAST: userNames.last,
                SCORE: relationship.score,
                SCOREPOSITION: score.position,
                SCOREPERCENTAGE: score.percentage,
                SCORERELATION: 'their',
                APPURL: process.env.APP_URL
              }, sender: { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL }, user: (<User & mongoose.Document>meeting.recipient) }, { delay: delay });
              // FLOW: Update relationship score
              await this.relationship.findByIdAndUpdate(relationship._id, { score: relationship.score + 20 }, { new: true });
            } else if(editMeetingData.status === MeetingStatus.Rejected) { // FLOW: If status is edited to Happened, increase ShipRank for rank/add new rank if one does not already exist
              if((<User & mongoose.Document>meeting.recipient).dateRegistered) {
                const client = await calendar.createClient((<User & mongoose.Document>meeting.recipient).googleRefreshToken);
                await calendar.cancelEvent(client, meeting.googleEventId);
              }
              // FLOW: Send Rejection email
              const userNames = email.formatNames((<User & mongoose.Document>meeting.initiator).name);
              const recipientNames = email.formatNames((<User & mongoose.Document>meeting.recipient).name);
              const relationships = await this.relationship.find({ userIds: (<User & mongoose.Document>meeting.initiator)._id });
              const relationship = relationships.filter((relationship) => { return relationship.userIds.includes((<User & mongoose.Document>meeting.recipient)._id.toString()); })[0];
              const score = email.formatScore(relationships, relationship._id);
              await email.sendTemplateEmail(EmailTemplate.Rejected, [{ email: (<User & mongoose.Document>meeting.initiator).email, name: (<User & mongoose.Document>meeting.initiator).name }], {
                FIRSTNAME: userNames.first,
                LASTNAME: userNames.last,
                FRIENDFIRST: recipientNames.first,
                FRIENDLAST: recipientNames.last,
                SCORE: relationship.score,
                SCOREPOSITION: score.position,
                SCOREPERCENTAGE: score.percentage,
                APPURL: process.env.APP_URL
              }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
            }
          }
          editMeetingData.dateStatusLastUpdated = new Date();
        } else {
          delete editMeetingData.status;
        }
        Object.assign(editMeetingObject, editMeetingData);
        meeting = await this.meeting.findByIdAndUpdate(meeting._id, editMeetingObject, { new: true });
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
    if(meeting && meeting.initiator === user._id) {
      await meeting.populate('initiator').execPopulate();
      await meeting.populate('recipient').execPopulate();
      // FLOW: Delete gcal event
      const client = await calendar.createClient(user.googleRefreshToken);
      await calendar.cancelEvent(client, meeting.googleEventId);
      // FLOW: Send cancelation email
      const userNames = email.formatNames((<User & mongoose.Document>meeting.recipient).name);
      const recipientNames = email.formatNames((<User & mongoose.Document>meeting.initiator).name);
      const relationships = await this.relationship.find({ userIds: (<User & mongoose.Document>meeting.initiator)._id.toString() });
      const relationship = relationships.filter((relationship) => { return relationship.userIds.includes((<User & mongoose.Document>meeting.recipient)._id.toString()); })[0];
      const score = email.formatScore(relationships, relationship._id);
      await email.sendTemplateEmail(EmailTemplate.Invitation, [{ email: (<User & mongoose.Document>meeting.recipient).email , name: (<User & mongoose.Document>meeting.recipient).name }], {
        FIRSTNAME: userNames.first,
        LASTNAME: userNames.last,
        FRIENDFIRST: recipientNames.first,
        FRIENDLAST: recipientNames.last,
        SCORE: relationship.score,
        SCOREPOSITION: score.position,
        SCOREPERCENTAGE: score.percentage,
        APPURL: process.env.APP_URL
      }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
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
