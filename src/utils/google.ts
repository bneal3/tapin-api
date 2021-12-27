import * as mongoose from 'mongoose';
const { google } = require('googleapis');

import { Meeting, CreateMeetingDto, User, UserModel } from '../models/index';
import Logger from './logger';

class Google {
  private static instance: Google;

  private api = google;

  constructor() {}

  public async createClient(token: string) {
    const oauthClient = new this.api.auth.OAuth2(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    oauthClient.setCredentials(token);
    return oauthClient;
  }

  public async getEvent(client: any, eventId: string) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    return await new Promise((resolve, reject) => {
      calendar.events.insert({
        calendarId: 'primary',
        eventId: eventId
      }, (err: any, event: any) => {
        if(err) {
          console.log(err);
          reject(err);
        } else{
          console.log(event);
          resolve(event);
        }
      });
    });
  }

  public async createEvent(client: any, createMeetingData: CreateMeetingDto) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    console.log(calendar);
    return await new Promise((resolve, reject) => {
      calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: 'none',
        resource: {
          summary: createMeetingData.title,
          start: {
            dateTime: createMeetingData.dateStart.toString()
          },
          end: {
            dateTime: createMeetingData.dateEnd.toString()
          },
          attendees: [
            { email: createMeetingData.recipient.email }
          ]
        }
      }, (err: any, event: any) => {
        if(err) {
          console.log(err);
          reject(err);
        } else{
          console.log(event);
          resolve(event);
        }
      });
    });
  }

  public async updateEvent(client: any, eventId: string, updateData: any) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    return await new Promise((resolve, reject) => {
      calendar.events.udpate({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'none',
        resource: updateData
      }, (err: any, res: any) => {
        if(err) {
          console.log(err);
          reject(err);
        } else{
          console.log(event);
          resolve(event);
        }
      });
    });
  }

  public async cancelEvent(client: any, eventId: string) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    await new Promise((resolve, reject) => {
      calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'none',
      }, (err: any, res: any) => {
        if(err) {
          console.log(err);
          reject();
        } else{
          resolve();
        }
      });
    });
  }

  public static getInstance(): Google {
    if (!Google.instance) {
      Google.instance = new Google();
    }
    return Google.instance;
  }
}

export default Google;
