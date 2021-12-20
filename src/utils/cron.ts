import { RecurrenceRule, scheduleJob } from 'node-schedule';
import * as mongoose from 'mongoose';

import Logger from './logger';
import { User, UserModel } from '../models/index';

class Cron {
  private static instance: Cron;

  constructor() {}

  // TODO: Create score update job
  public setScoreUpdateJob() {
    const weeklyResetRule = new RecurrenceRule();
    weeklyResetRule.dayOfWeek = 6; // Monday
    weeklyResetRule.hour = 0; // 12pm PST
    weeklyResetRule.minute = 25; // 0
    scheduleJob(weeklyResetRule, async () => {
      // TODO: Go through each user's score list and add to score based on day since last meeting
    });
  }

  // TODO: Create relationship reminder jobs
  public setWeeklyReminderJob() {
    const weeklyResetRule = new RecurrenceRule();
    weeklyResetRule.dayOfWeek = 6; // Monday
    weeklyResetRule.hour = 0; // 12pm PST
    weeklyResetRule.minute = 25; // 0
    scheduleJob(weeklyResetRule, async () => {
      // TODO: Select one person from batch of relationships as flagship for email
      // TODO: Send email
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
