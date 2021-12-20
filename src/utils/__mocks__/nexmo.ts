import * as mongoose from 'mongoose';
import { Job } from 'bull';
// @ts-ignore
import { IsOptional, IsNumber, IsDateString, IsString } from 'class-validator';
import * as https from 'https';

import { Conversation, ConversationModel, ConversationStatus, User, UserModel, Message, MessageModel, CommandType, ScheduleType, MessageStatus, MessagePriority } from '../../models/index';
import Logger from './../logger';
import Bull from './../bull';
import { scheduleService } from '../../services/index';
import { sendEmail } from './../helpers';

const stripe = require('stripe')(process.env.STRIPE_SECRET);

import { VerifyError, RequestResponse, CheckResponse, ControlResponse } from 'nexmo';

class Nexmo {
  private static instance: Nexmo;

  public VERIFICATION_TIMEOUT = 240;

  private notificationOptions = {
    limiter: {
      max: 30,
      duration: 1500
    },
    defaultJobOptions: {
      backoff: { type: 'fixed', delay: 1500 },
      attempts: 1800,
      removeOnComplete: true
    },
    createClient: Bull.getInstance().createClient
  };
  private numberOptions = {
    limiter: {
      max: 1,
      duration: 1500
    },
    defaultJobOptions: {
      backoff: { type: 'fixed', delay: 1500 },
      attempts: 1800,
      removeOnComplete: true
    },
    createClient: Bull.getInstance().createClient
  };

  constructor() {
    // FLOW: Open all connections to numbers at start
    Bull.getInstance().get(`nexmo-${process.env.NOTIFICATION_NUMBER}`, this.notificationOptions, this.deliverText);
    Bull.getInstance().get(`nexmo-${process.env.SUPPORT_NUMBER}`, this.numberOptions, this.deliverText);
    UserModel.find({ verified: true }).then((verified) => {
      verified.forEach((user) => {
        if(user.virtual) { Bull.getInstance().get(`nexmo-${user.virtual}`, this.numberOptions, this.deliverText); }
        if(user.receiver) { Bull.getInstance().get(`nexmo-${user.receiver}`, this.numberOptions, this.deliverText); }
      });
    });
  }

  public async deliverText(job: Job) {
    return new Promise(async (resolve, reject) => {
      let shouldSend = true;
      // FLOW: Check to see if same message was sent within the day
      if(job.data.schedule !== undefined) {
        const message = await MessageModel.findById(job.id);
        shouldSend = await scheduleService.checkSchedule(job.data.schedule, message);
      }
      if(shouldSend) {
        if(job.data.to.phone) {
          let updateParameters: any = {
            virtual: job.data.number,
            sentId: job.id,
            status: MessageStatus.Sent,
            dateStatusLastUpdated: Date.now()
          };
          if(job.data.messageId) {
            updateParameters.messageId = job.data.messageId;
          }
          const message = await MessageModel.findByIdAndUpdate(job.id, updateParameters, { new: true });
          resolve(message);
        } else {
          const failed = await MessageModel.findByIdAndUpdate(job.id, {
            virtual: job.data.number,
            status: MessageStatus.Failed,
            dateStatusLastUpdated: Date.now()
          }, { new: true });
          resolve(failed);
        }
      } else {
        const retracted = await MessageModel.findByIdAndUpdate(job.id, {
          virtual: job.data.number,
          status: MessageStatus.Retracted,
          dateStatusLastUpdated: Date.now()
        }, { new: true });
        resolve(retracted);
      }
    });
  }

  public async sendNotification(message: (Message & mongoose.Document), text: string, data: any = {}, options: any = {}) {
    // FLOW: Find correct queue
    const queue = Bull.getInstance().get(`nexmo-${process.env.NOTIFICATION_NUMBER}`, this.notificationOptions, this.deliverText);
    if(data.schedule === undefined) { data.schedule = ScheduleType.Notification; }
    const jobData = {
      number: process.env.NOTIFICATION_NUMBER,
      to: message.to,
      text: text,
      ...data
    };
    const jobOptions = { jobId: message._id, ...options };

    // FLOW: Update status to traveling while in intermediary step
    await MessageModel.findByIdAndUpdate(message._id, {
      status: MessageStatus.Traveling,
      dateStatusLastUpdated: Date.now()
    });
    // FLOW: Add job to queue
    try {
      return await queue.add(jobData, jobOptions);
    } catch (err) { // FLOW: Update message to reflect failed job push
      await MessageModel.findByIdAndUpdate(message._id, {
        status: MessageStatus.Failed,
        dateStatusLastUpdated: Date.now()
      });
      return undefined;
    }
  }

  public async sendSystemNotification(to: mongoose.Types.ObjectId, text: string, sender: string, data: any = {}, options: any = {}) {
    const message = await MessageModel.create({
      to: to,
      text: text,
      priority: MessagePriority.System
    });
    await message.populate('to', '-password').execPopulate();
    const user = <User>message.to;
    if(user && user.phone) {
      return await this.sendNotification(message, `New Notification from\n${sender}:\n${message.text}`, data, options);
    } else {
      await MessageModel.findByIdAndUpdate(message._id, {
        status: MessageStatus.Failed,
        dateStatusLastUpdated: Date.now()
      });
      return undefined;
    }
  }

  public async sendLink(to: mongoose.Types.ObjectId, text: string, data: any = {}, options: any = {}) {
    const message = await MessageModel.create({
      to: to,
      text: text,
      priority: MessagePriority.System
    });
    await message.populate('to', '-password').execPopulate();
    const user = <User>message.to;
    if(user && user.phone) {
      return await this.sendNotification(message, `${message.text}`, data, options);
    } else {
      await MessageModel.findByIdAndUpdate(message._id, {
        status: MessageStatus.Failed,
        dateStatusLastUpdated: Date.now()
      });
      return undefined;
    }
  }

  public async sendText(message: (Message & mongoose.Document), text: string, number: string, data: any = {}, options: any = {}) {
    // FLOW: Find correct queue
    const queue = Bull.getInstance().get(`nexmo-${number}`, this.numberOptions, this.deliverText);
    const jobData = {
      number: number,
      to: message.to,
      text: text,
      ...data
    };
    const jobOptions = { jobId: message._id, ...options };

    // FLOW: Update status to traveling while in intermediary step
    await MessageModel.findByIdAndUpdate(message._id, {
      status: MessageStatus.Traveling,
      dateStatusLastUpdated: Date.now()
    });

    // FLOW: Add job to queue
    try {
      return await queue.add(jobData, jobOptions);
    } catch (err) { // FLOW: Update message to reflect failed job push
      await MessageModel.findByIdAndUpdate(message._id, {
        status: MessageStatus.Failed,
        dateStatusLastUpdated: Date.now()
      });
      return undefined;
    }
  }

  public deliveryError = async (text: (Message & mongoose.Document)) => {
    let parameters: any = {
      status: MessageStatus.Failed,
      dateStatusLastUpdated: Date.now()
    };
    await text.populate('to').populate('from').populate('conversation').execPopulate();
    const to = <User & mongoose.Document>text.to;
    const from = <User & mongoose.Document>text.from;
    let conversation = <Conversation & mongoose.Document>text.conversation;
    let message: string | undefined = undefined;
    let number: string | undefined = undefined;
    if(from && from.phone) {
      if(to && to.phone) {
        if(from.verified && text.priority === MessagePriority.Response) { // FLOW: If from verified and paid priority, refund message and notify customer
          if(conversation && conversation.status === ConversationStatus.Completed && conversation.paymentIntentId) {
            const paymentIntent = await stripe.paymentIntents.retrieve(conversation.paymentIntentId);
            if(paymentIntent.status === 'succeeded' && paymentIntent.amount_received >= conversation.rate) { // FLOW: If amount of payment intent is gte the rate (1 message), give refund for 1 message
              try {
                const refund = await stripe.refunds.create({ payment_intent: conversation.paymentIntentId, amount: conversation.rate * 1 });
                conversation = await ConversationModel.findByIdAndUpdate(conversation._id, { refundId: refund.id }, { new: true });
                Logger.getInstance().logger.info('Refunded gifted response that failed to deliver', { metadata: refund });
                await this.sendSystemNotification(from._id, `One of ${(from.name ?? from.username).split(' ')[0]}'s responses failed to deliver. You were not charged.`, process.env.APP_NAME, { schedule: ScheduleType.None });
                message = `A paid response you sent to ${(to.name ?? to.username).split(' ')[0]} failed to deliver. They were not charged.`;
              } catch (err) {
                Logger.getInstance().logger.info('Problem creating refund for failed delivery', { metadata: err });
                message = undefined;
                await sendEmail(process.env.NOTIFICATION_EMAIL, 'Uncaptured Payment Error',
                  `There was a problem refunding ${to.username}\'s payment to ${from.name ?? from.username}.\n
Please manually refund the amount of ${conversation.rate}¢ through Stripe using this paymentIntentId: ${conversation.paymentIntentId} as reference.`);
              }
            }
          }
        } else { // FLOW: If not from verified and paid priority, notify customer and send next in queue to verified
          number = to.virtual;
          if(text.priority === MessagePriority.Paid) {
            number = to.receiver;
            message = `One of your messages to ${(to.name ?? to.username).split(' ')[0]} failed to deliver. Please try again.`;
          }
        }
      } else {
        if(from.verified && text.priority === MessagePriority.Response) {
          message = `That user no longer exists. Text ${CommandType.Resend} to the number you received that user's text from.`;
        } else {
          message = `You sent a message to an unowned number. Please recheck where you saw this number.`;
        }
      }
    }
    await MessageModel.findByIdAndUpdate(text._id, parameters);
    if(message) { await this.sendSystemNotification(from._id, message, process.env.APP_NAME, { schedule: ScheduleType.None }); }
    if(number) { await this.sendQueueText(to, number); }
  }

  public async sendSystemText(to: mongoose.Types.ObjectId, text: string, number: string, data: any = {}, options: any = {}) {
    const message = await MessageModel.create({
      to: to,
      text: text,
      priority: MessagePriority.System
    });
    await message.populate('to', '-password').execPopulate();
    const user = <User>message.to;
    if(user && user.phone) {
      if(!data.schedule) { data.schedule = ScheduleType.Notification; }
      return await this.sendText(message, message.text, number, data, options);
    } else {
      await MessageModel.findByIdAndUpdate(message._id, {
        status: MessageStatus.Failed,
        dateStatusLastUpdated: Date.now()
      });
      return undefined;
    }
  }

  public async sendUserText(message: (Message & mongoose.Document), number: string) {
    await message.populate('from', '-password').populate('to', '-password').execPopulate();
    const from = <User>message.from;
    const to = <User>message.to;
    if(from && from.phone && to && to.phone) {
      let name = `@${from.username}`;
      if(from.name) { name = from.name; }
      return await this.sendText(message, `${name}:\n${message.text}`, number);
    } else {
      return undefined;
    }
  }

  public async sendQueueText(to: (User & mongoose.Document), number: string) {
    let priority = MessagePriority.Free;
    if(number === to.receiver) { priority = MessagePriority.Paid; }
    // FLOW: Get current queue
    const queue = await MessageModel.find({
      to: to._id,
      from: { $ne: null, $exists: true },
      status: { $in: [ MessageStatus.Pending, MessageStatus.Traveling, MessageStatus.Sent ] },
      priority: priority
    }).sort('dateReceived');
    // FLOW: Make sure there are no Sent or Traveling messages to user
    const sent = queue.filter((message) => { return message.status === MessageStatus.Sent || message.status === MessageStatus.Traveling; });
    const pending = queue.filter((message) => { return message.status === MessageStatus.Pending });
    if(sent.length === 0 && pending.length > 0) {
      let place = 0;
      do {
        const from = await UserModel.findById(pending[place].from);
        if(from && from.phone) {
          return await this.sendUserText(pending[place], number);
        } else {
          pending[place] = await MessageModel.findByIdAndUpdate(pending[place]._id, {
            status: MessageStatus.Failed,
            dateStatusLastUpdated: Date.now()
          }, { new: true });
          place += 1;
        }
      } while(place < queue.length);
    }
    return undefined;
  }

  public async verifyRequest(phone: string): Promise<VerifyError | RequestResponse> {
    return new Promise<VerifyError | RequestResponse>((resolve, reject) => {
      const response: RequestResponse = {
        request_id: '185970hfqwogiy7q',
        status: '0'
      };
      resolve(response);
    });
  }

  public async verifyCheck(requestId: string, code: string): Promise<VerifyError | CheckResponse> {
    return new Promise<VerifyError | CheckResponse>((resolve, reject) => {
      const response: CheckResponse = {
        request_id: requestId,
        event_id: 'eventId',
        status: '0',
        price: '0.0524802375',
        currency: 'USD'
      };
      resolve(response);
    });
  }

  public async verifyCancel(requestId: string): Promise<VerifyError | ControlResponse> {
    return new Promise<VerifyError | ControlResponse>((resolve, reject) => {
      const response: ControlResponse = {
        status: '0',
        command: 'Cancel'
      };
      resolve(response);
    });
  }

  public static getInstance(): Nexmo {
    if (!Nexmo.instance) {
      Nexmo.instance = new Nexmo();
    }

    return Nexmo.instance;
  }
}

// public async deliverNotification(job: Bull.Job) {
//   return new Promise(async (resolve, reject) => {
//     const message = await MessageModel.findByIdAndUpdate(job.id, {
//       virtual: process.env.SHORTCODE,
//       status: MessageStatus.Sent,
//       dateStatusLastUpdated: Date.now()
//     }, { new: true });
//     resolve(message);
//   });
// }

export default Nexmo;
