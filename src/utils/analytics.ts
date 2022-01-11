import * as mongoose from 'mongoose';
import Segment = require('analytics-node');
const segment = new Segment(process.env.SEGMENT_WRITE_KEY);

import { ServiceDependencyException } from './exceptions';
import { Meeting, CreateMeetingDto, User, UserModel } from '../models/index';
import Logger from './logger';

class Analytics {
  private static instance: Analytics;

  private api = segment;

  constructor() {}

  public identify(user: (User & mongoose.Document)) {
    this.api.identify({
      userId: user._id.toString(),
      traits: {
        name: user.name,
        email: user.email
      }
    });
  }

  public track(user: (User & mongoose.Document), event: string, properties: any = {}) {
    this.api.track({
      userId: user._id.toString(),
      event: event,
      properties: properties
    });
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }
}

export default Analytics;
