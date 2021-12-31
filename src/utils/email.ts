import { Job } from 'bull';
import * as mongoose from 'mongoose';
const SendinBlueAPI = require('sib-api-v3-sdk');

import { Meeting, MeetingModel, MeetingStatus, User, UserModel } from '../models/index';
import Bull from './bull';
import Logger from './logger';

export enum EmailTemplate {
  Invitation = 1,
  Accepted,
  Rejected,
  Canceled,
  PostEvent,
  Reminder
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
    let shouldSend = await Email.getInstance().shouldSend(job.data);
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
        case EmailTemplate.PostEvent:
          // FLOW: If event was canceled, do not send
          const meeting = <Meeting & mongoose.Document>data.meeting;
          if(!meeting || meeting.status === MeetingStatus.Canceled) { return false; }
          return true;
        default:
          return true;
      }
    }
    return false;
  }

  public static getInstance(): Email {
    if (!Email.instance) {
      Email.instance = new Email();
    }
    return Email.instance;
  }
}

export default Email;
