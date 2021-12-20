import { RecurrenceRule, scheduleJob } from 'node-schedule';
import * as mongoose from 'mongoose';

import Logger from './logger';
import { User, UserModel } from '../models/index';

class Cron {
  private static instance: Cron;

  constructor() {}

  public setNumberDeletionJob() {
    const weeklyResetRule = new RecurrenceRule();
    weeklyResetRule.dayOfWeek = 6; // Monday
    weeklyResetRule.hour = 0; // 12pm PST
    weeklyResetRule.minute = 25; // 0
    scheduleJob(weeklyResetRule, async () => {});
  }

  public static getInstance(): Cron {
    if(!Cron.instance) {
      Cron.instance = new Cron();
    }
    return Cron.instance;
  }
}

export default Cron;
