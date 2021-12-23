import { RecurrenceRule, scheduleJob } from 'node-schedule';
import * as mongoose from 'mongoose';

import { AccessType } from '../interfaces/index';
import { Meeting, MeetingModel, MeetingStatus, Score, ScoreModel, User, UserModel } from '../models/index';
import Logger from './logger';
import Sendinblue, { EmailTemplate } from './sendinblue';

import { authenticationService } from '../services/index';

class Cron {
  private static instance: Cron;

  private meeting = MeetingModel;
  private score = ScoreModel;
  private user = UserModel;

  constructor() {
    this.setScoreUpdateJob();
  }

  // FLOW: Create score update job
  public setScoreUpdateJob() {
    const dailyResetRule = new RecurrenceRule();
    dailyResetRule.hour = 0;
    dailyResetRule.minute = 0;
    scheduleJob(dailyResetRule, async () => {
      // FLOW: Go through each user's score list and add to score based on day since last meeting
      const users = await this.user.find({});
      const scores: any[] = [];
      users.forEach((user) => {
        const scoreQuery = this.score.find({ source: user._id });
        scores.push(scoreQuery);
      });
      await Promise.all(scores).then((userScores) => {
        userScores.forEach(async (scoreGroup) => {
          const source = <mongoose.Schema.Types.ObjectId>scoreGroup[0].source;
          scoreGroup.forEach(async (score: (Score & mongoose.Document)) => {
            // FLOW: Get meetings for score calculation
            const target = <mongoose.Schema.Types.ObjectId>score.target;
            const meetings = await this.meeting.find({
              initiator: source,
              recipient: target,
              status: MeetingStatus.Happened
            }).sort(['dateStart', -1]);
            // FLOW: Calculate score
            const value = meetings.length / Math.pow((new Date()).getDay() - meetings[0].dateStart.getDay(), Number(process.env.GRAVITY_CONSTANT));
            // FLOW: Update score
            await this.score.findByIdAndUpdate(score._id, { value: value });
          });
        });
      });
    });
  }

  // FLOW: Create relationship reminder job
  public setRelationshipReminderJob() {
    const weeklyResetRule = new RecurrenceRule();
    weeklyResetRule.dayOfWeek = 0; // Sunday
    weeklyResetRule.hour = 17; // 5pm GMT
    weeklyResetRule.minute = 0; // 0
    scheduleJob(weeklyResetRule, async () => {
      const users = await this.user.find({});
      const scores: any[] = [];
      users.forEach((user) => {
        const scoreQuery = this.score.find({ source: user._id }).sort(['value', 1]);
        scores.push(scoreQuery);
      });
      await Promise.all(scores).then((userScores) => { // userScores = array of arrays of users' scores
        userScores.forEach(async (scoreGroup) => { // scoreGroup = array of user's scores
          await scoreGroup[0].populate('source').execPopulate();
          const source = <User & mongoose.Document>scoreGroup[0].source;
          let featuredIndex = -1;
          scoreGroup.forEach(async (score: (Score & mongoose.Document), index: number) => {
            // FLOW: Select one person from batch of relationships as flagship for email
            const target = <mongoose.Schema.Types.ObjectId>score.target;
            const meetings = await this.meeting.find({
              initiator: source,
              recipient: target,
              status: MeetingStatus.Happened
            }).sort(['dateStart', -1]);
            // FLOW: Check if time between now and last meeting is greater than minimum follow up reminder time
            if(meetings[0].dateEnd.getTime() - (new Date()).getTime() >= Number(process.env.MINIMUM_REMINDER_TIME)) { featuredIndex = index; }
          });
          if(featuredIndex >= 0) {
            await scoreGroup[featuredIndex].populate('target').execPopulate();
            const target = <User & mongoose.Document>scoreGroup[featuredIndex].target;
            // FLOW: Send email
            const authentication = await authenticationService.createToken(source._id, AccessType.auth, Number(process.env.AUTHENTICATION_EXPIRATION) * 3);
            await Sendinblue.getInstance().sendTemplateEmail(EmailTemplate.Reminder, [{ email: source.email , name: source.name }], { FIRSTNAME: source.name.split(' ')[0], FEATUREDNAME: target.name, APPURL: process.env.APP_URL, _SI: authentication._si }, { name: process.env.APP_NAME, email: process.env.NOREPLY_EMAIL });
          }
        });
      });
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
