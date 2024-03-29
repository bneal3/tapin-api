import * as mongoose from 'mongoose';
const { google } = require('googleapis');

import { ServiceDependencyException } from './exceptions';
import { Meeting, CreateMeetingDto, User, UserModel } from '../models/index';
import Logger from './logger';

class Calendar {
  private static instance: Calendar;

  private api = google;

  constructor() {}

  public async createClient(refreshToken: string) {
    try {
      const client = new this.api.auth.OAuth2(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET, process.env.REDIRECT_URIS.split(","));
      client.setCredentials({ refresh_token: refreshToken });
      // FLOW: Check validity of refresh token
      const auth = google.oauth2({ version: 'v2', auth: client });
      await new Promise((resolve, reject) => {
        auth.userinfo.get((err: any, res: any) => {
          if(err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      return client;
    } catch (err) {
      // FLOW: Cause special exception if refreshToken no longer works to signal to frontend to re-sign in
      console.log(err);
      throw new ServiceDependencyException();
    }
  }

  public async getEvent(client: any, eventId: string) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    return await new Promise((resolve, reject) => {
      calendar.events.list({
        auth: client,
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
    return await new Promise((resolve, reject) => {
      calendar.events.insert({
        auth: client,
        calendarId: 'primary',
        sendUpdates: 'none',
        resource: {
          summary: createMeetingData.title,
          start: {
            dateTime: createMeetingData.timeStart
          },
          end: {
            dateTime: createMeetingData.timeEnd
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
      calendar.events.patch({
        auth: client,
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'none',
        resource: updateData
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

  public async cancelEvent(client: any, eventId: string) {
    const calendar = google.calendar({ version: 'v3', auth: client });
    await new Promise((resolve, reject) => {
      calendar.events.delete({
        auth: client,
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'none'
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

  public static getInstance(): Calendar {
    if (!Calendar.instance) {
      Calendar.instance = new Calendar();
    }
    return Calendar.instance;
  }
}

export default Calendar;
