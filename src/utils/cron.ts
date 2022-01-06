import { RecurrenceRule, scheduleJob } from 'node-schedule';
import * as mongoose from 'mongoose';

import { AccessType } from '../interfaces/index';
import { Meeting, MeetingModel, MeetingStatus, Relationship, RelationshipModel, User, UserModel } from '../models/index';
import Logger from './logger';
import Email, { EmailTemplate } from './email';
import Bull from './bull';

import { authenticationService } from '../services/index';

class Cron {
  private static instance: Cron;

  private reminderEmailCacheOptions = {
    defaultJobOptions: {
      backoff: { type: 'fixed', delay: Number(process.env.REMINDER_EMAIL_CACHE_LENGTH) },
      removeOnComplete: true
    },
    createClient: Bull.getInstance().createClient
  };

  constructor() {
    Bull.getInstance().get(`reminderEmailCache`, this.reminderEmailCacheOptions, () => {});
    this.setRankUpdateJob();
    this.setRelationshipReminderJob();
  }

  // FLOW: Create rank update job
  private setRankUpdateJob() {
    const dailyResetRule = new RecurrenceRule();
    dailyResetRule.hour = 0;
    dailyResetRule.minute = 0;
    scheduleJob(dailyResetRule, async () => {
      await Cron.getInstance().rankUpdateJob();
    });
  }

  public async rankUpdateJob()  {
    // FLOW: Go through each user's relationship list and update ShipScore based on day since last meeting
    const relationships = await RelationshipModel.find({});
    relationships.forEach(async (relationship: (Relationship & mongoose.Document)) => {
      // FLOW: Get meetings for ShipScore calculation
      const firstId: any = new mongoose.Types.ObjectId(relationship.userIds[0]);
      const secondId: any = new mongoose.Types.ObjectId(relationship.userIds[1]);
      const meetings = await MeetingModel.find({
        $or: [{
          initiator: firstId,
          recipient: secondId
        }, {
          initiator: secondId,
          recipient: firstId
        }],
        status: { $nin: [MeetingStatus.Rejected, MeetingStatus.Canceled] },
        'confirmed.0': { "$exists": true }
      }).sort({ dateEnd: -1 });
      // FLOW: Calculate ShipScore
      const value = relationship.score / Math.pow(((new Date()).getDay() - meetings[0].dateEnd.getDay()) + 2, Number(process.env.GRAVITY_CONSTANT));
      // FLOW: Update relationship
      await RelationshipModel.findByIdAndUpdate(relationship._id, { value: value });
    });
  }

  // FLOW: Create relationship reminder job
  private setRelationshipReminderJob() {
    const weeklyResetRule = new RecurrenceRule();
    weeklyResetRule.dayOfWeek = 0; // Sunday
    weeklyResetRule.hour = 17; // 5pm GMT
    weeklyResetRule.minute = 0; // 0
    scheduleJob(weeklyResetRule, async () => {
      await Cron.getInstance().relationshipReminderJob();
    });
  }

  public async relationshipReminderJob() {
    const users = await UserModel.find({});
    const relationshipObjects: any[] = [];
    users.forEach(async (user) => {
      const relationships = await RelationshipModel.find({ userIds: user._id.toString() }).sort(['value', 1]);
      relationshipObjects.push({
        user: user,
        relationships: relationships
      });
    });
    relationshipObjects.forEach(async (relationshipObject) => {
      let featuredIndex = -1;
      relationshipObject.relationships.forEach(async (relationship: (Relationship & mongoose.Document), index: number) => {
        // FLOW: Select one person from batch of relationships as flagship for email
        const firstId: any = new mongoose.Types.ObjectId(relationship.userIds[0]);
        const secondId: any = new mongoose.Types.ObjectId(relationship.userIds[1]);
        const meetings = await MeetingModel.find({
          $or: [{
            initiator: firstId,
            recipient: secondId
          }, {
            initiator: secondId,
            recipient: firstId
          }],
          status: { $nin: [MeetingStatus.Rejected, MeetingStatus.Canceled] },
          'confirmed.0': { "$exists": true }
        }).sort({ dateEnd: -1 });
        // FLOW: Check if current user is in cache
        const queue = Bull.getInstance().get(`reminderEmailCache`, Cron.getInstance().reminderEmailCacheOptions, () => {});
        const jobId = `${relationshipObject.user._id.toString()}:${relationship.userIds.filter((userId: string) => { return userId !== relationshipObject.user._id.toString(); })[0]}`;
        const job = await queue.getJob(jobId);
        // FLOW: Check if time between now and last meeting is greater than minimum follow up reminder time (1 month)
        if(meetings.length > 0 && (new Date()).getTime() - meetings[0].dateEnd.getTime() >= Number(process.env.MINIMUM_REMINDER_TIME) * 30 && !job) { featuredIndex = index; }
      });
      if(featuredIndex >= 0) {
        // FLOW: Get featuredUser
        const featuredId = relationshipObject.relationships[featuredIndex].userIds.filter((userId: string) => { return userId != relationshipObject.user._id.toString(); })[0];
        const featured = await UserModel.findById(featuredId);
        // FLOW: Send email
        const emailData = await Email.getInstance().coreFormat(relationshipObject.user, featured, relationshipObject.user._id);
        await Email.getInstance().sendTemplateEmail(EmailTemplate.Reminder, [{ email: relationshipObject.user.email , name: relationshipObject.user.name }], {
          FIRSTNAME: emailData.recipient.first,
          LASTNAME: emailData.recipient.last,
          FRIENDFIRST: emailData.friend.first,
          FRIENDLAST: emailData.friend.last,
          SCORE: emailData.scoreData.score,
          SCOREPOSITION: emailData.scoreData.position,
          SCOREPERCENTAGE: emailData.scoreData.percentage,
          APPURL: process.env.APP_URL
        }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
        // FLOW: Add user to cache
        const jobId = `${relationshipObject.user._id.toString()}:${relationshipObject.relationships[featuredIndex].userIds.filter((userId: string) => { return userId !== relationshipObject.user._id.toString(); })[0]}`;
        Bull.getInstance().get(`reminderEmailCache`, Cron.getInstance().reminderEmailCacheOptions, () => {}).add({}, { jobId: jobId });
      }
    });
  }

  public static getInstance(): Cron {
    if(!Cron.instance) {
      Cron.instance = new Cron();
    }
    return Cron.instance;
  }
}

export default Cron;
