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
      backoff: { type: 'fixed', delay: 10000 },
      attempts: 6,
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
    // FLOW: Go through each user's relationship list and update ShipRank based on day since last meeting
    const relationships = await RelationshipModel.find({});
    relationships.forEach(async (relationship: (Relationship & mongoose.Document)) => {
      // FLOW: Get meetings for ShipRank calculation
      const firstId = new mongoose.Schema.Types.ObjectId(relationship.userIds[0]);
      const secondId = new mongoose.Schema.Types.ObjectId(relationship.userIds[1]);
      const meetings = await MeetingModel.find({
        $or: [{
          initiator: firstId,
          recipient: secondId
        }, {
          initiator: secondId,
          recipient: firstId
        }],
        status: MeetingStatus.Happened
      }).sort(['dateStart', -1]);
      // FLOW: Calculate ShipRank
      const value = relationship.score / Math.pow(((new Date()).getDay() - meetings[0].dateStart.getDay()) + 2, Number(process.env.GRAVITY_CONSTANT));
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

  // TODO: Cache who was in featured email by queueing who was featured in bull and then having the entry dissipate after x weeks
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
        const firstId = new mongoose.Schema.Types.ObjectId(relationship.userIds[0]);
        const secondId = new mongoose.Schema.Types.ObjectId(relationship.userIds[1]);
        const meetings = await MeetingModel.find({
          $or: [{
            initiator: firstId,
            recipient: secondId
          }, {
            initiator: secondId,
            recipient: firstId
          }],
          status: MeetingStatus.Happened
        }).sort(['dateStart', -1]);
        // FLOW: Check if time between now and last meeting is greater than minimum follow up reminder time (1 month)
        // TODO: Check if current user is in cache, if so set featuredIndex = -1
        if((new Date()).getTime() - meetings[0].dateEnd.getTime() >= Number(process.env.MINIMUM_REMINDER_TIME) * 30
            ) { featuredIndex = index; }
      });
      if(featuredIndex >= 0) {
        // FLOW: Get featuredUser
        const featuredId = relationshipObject.relationships[featuredIndex].userIds.filter((userId: string) => { return userId != relationshipObject.user._id.toString(); })[0];
        const featured = await UserModel.findById(featuredId);
        // FLOW: Send email
        const userNames = relationshipObject.user.name.split(' ');
        const userFirstName = userNames[0];
        let userLastName = '';
        if(userNames.length > 1) { userLastName = userNames[1]; }
        const featuredNames = featured.name.split(' ');
        const featuredFirstName = featuredNames[0];
        let featuredLastName = '';
        if(featuredNames.length > 1) { featuredLastName = featuredNames[1]; }
        await Email.getInstance().sendTemplateEmail(EmailTemplate.Reminder, [{ email: relationshipObject.user.email , name: relationshipObject.user.name }], { FIRSTNAME: userFirstName, LASTNAME: userLastName, FRIENDFIRST: featuredFirstName, FRIENDLAST: featuredLastName, APPURL: process.env.APP_URL }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
        // TODO: Add user to cache
        Bull.getInstance().get(`reminderEmailCache`, Cron.getInstance().reminderEmailCacheOptions, () => {}).add({});
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
