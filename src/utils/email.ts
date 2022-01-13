import { Job } from 'bull';
import * as mongoose from 'mongoose';
const SendinBlueAPI = require('sib-api-v3-sdk');
const dayjs = require('dayjs');

import { Meeting, MeetingModel, MeetingStatus, Relationship, RelationshipModel, User, UserModel } from '../models/index';
import Bull from './bull';
import Logger from './logger';

export enum EmailTemplate {
  Invitation = 1,
  Accepted,
  Rejected,
  PostEvent,
  Canceled,
  Reminder,
  Updated,
  Approval
}

class Email {
  private static instance: Email;

  private client = SendinBlueAPI.ApiClient.instance;
  private transactionalAPI = new SendinBlueAPI.TransactionalEmailsApi();
  private emailOptions = {
    defaultJobOptions: {
      backoff: { type: 'fixed', delay: 10000 },
      attempts: 6,
      removeOnComplete: true
    },
    createClient: Bull.getInstance().createClient
  };

  constructor() {
    // Configure API key authorization: api-key
    const apiKey = this.client.authentications['api-key'];
    apiKey.apiKey = process.env.SENDINBLUE_KEY;
    // Configure API key authorization: partner-key
    const partnerKey = this.client.authentications['partner-key'];
    partnerKey.apiKey = process.env.SENDINBLUE_KEY;
    // FLOW: Open all connections to numbers at start
    Bull.getInstance().get(`email`, this.emailOptions, this.emailJob);
  }

  public async sendTemplateEmail(templateId: number, to: [any], params: any = {}, sender: any = { name: process.env.APP_NAME, address: process.env.NOREPLY_EMAIL }) {
    const sendSmtpEmail = new SendinBlueAPI.SendSmtpEmail();
    sendSmtpEmail.templateId = templateId;
    sendSmtpEmail.to = to;
    sendSmtpEmail.params = params;
    sendSmtpEmail.sender = sender;
    return await new Promise((resolve, reject) => {
      this.transactionalAPI.sendTransacEmail(sendSmtpEmail).then((data: any) => {
        console.log('API called successfully. Returned data: ' + data);
        resolve(data);
      }, (error: any) => {
        console.log(error);
        reject(error);
      });
    });
  }

  public async emailJob(job: Job) {
    const shouldSend = await Email.getInstance().shouldSend(job.data);
    if(shouldSend) {
      return await Email.getInstance().sendTemplateEmail(job.data.templateId, job.data.to, job.data.params, job.data.sender);
    }
    return false;
  }

  public async queueEmail(data: any, options: any = {}) {
    // FLOW: Find correct queue
    const queue = Bull.getInstance().get(`email`, this.emailOptions, this.emailJob);
    const jobData = { ...data };
    const jobOptions = { ...options };
    try { // FLOW: Add job to queue
      return await queue.add(jobData, jobOptions);
    } catch (err) {
      return undefined;
    }
  }

  public async shouldSend(data: any) {
    const template = <EmailTemplate>data.templateId;
    const receiver = <User & mongoose.Document>data.to;
    if(template && receiver) {
      switch(template) {
        case EmailTemplate.PostEvent: // (meetingId, dateEnd)
          // FLOW: If event was canceled, do not send
          const meeting = await MeetingModel.findById(data.meetingId);
          if(!meeting || meeting.status !== MeetingStatus.Accepted || meeting.dateEnd !== data.dateEnd) { return false; }
          return true;
        default:
          return true;
      }
    }
    return false;
  }

  public async coreFormat(recipient: (User & mongoose.Document), friend: (User & mongoose.Document), relationshipUserId: mongoose.Types.ObjectId) {
    const recipientNames = this.formatNames(recipient.name);
    const friendNames = this.formatNames(friend.name);
    const relationships = await RelationshipModel.find({ userIds: relationshipUserId.toString() });
    const relationship = relationships.filter((relationship) => { return relationship.userIds.includes(relationshipUserId.toString()); })[0];
    const score = this.formatScore(relationships, relationship._id);
    return {
      recipient: recipientNames,
      friend: friendNames,
      scoreData: score
    };
  }

  public formatNames(name: string) {
    const names = name.split(' ');
    const first = names[0];
    let last = '';
    if(names.length > 1) { last = names[1]; }
    return {
      first: first,
      last: last
    }
  }

  public formatScore(relationships: (Relationship & mongoose.Document)[], relationshipId: mongoose.Types.ObjectId) {
    relationships = relationships.sort((a: (Relationship & mongoose.Document), b: (Relationship & mongoose.Document)) => { return a.score - b.score; }); // ascending
    let index = -1;
    for(let i = 0; i < relationships.length; i++) {
      if(relationships[i]._id.equals(relationshipId)) {
        index = i;
        break;
      }
    }
    let percentage = 10;
    let position = 'bottom';
    if(index >= 0) {
      let rawPercentage = (index + 1) / relationships.length;
      if(rawPercentage >= .5) {
        percentage = 100 - (Math.floor(rawPercentage * 10) * 10);
        position = 'top';
      } else {
        percentage = Math.ceil(rawPercentage * 10) * 10;
      }
    }
    return {
      percentage: percentage,
      position: position,
      score: relationships[index].score
    }
  }

  public formatDate(date: Date) {
    const dateString = date.toISOString();
    const formattedString = dayjs(dateString).format('ddd, MMMM D, YYYY [at] h A');
    return formattedString;
  }

  public static getInstance(): Email {
    if (!Email.instance) {
      Email.instance = new Email();
    }
    return Email.instance;
  }
}

export default Email;
