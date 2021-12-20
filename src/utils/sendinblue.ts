import * as mongoose from 'mongoose';
const SendinBlueAPI = require('sib-api-v3-sdk');

import { User, UserModel } from '../models/index';
import Logger from './logger';

export enum EmailSchedule {
  Account,
  Post,
  Deletion
}

class Sendinblue {
  private static instance: Sendinblue;

  private client = SendinBlueAPI.ApiClient.instance;
  private transactionalAPI = new SendinBlueAPI.TransactionalEmailsApi();

  constructor() {
    // Configure API key authorization: api-key
    const apiKey = this.client.authentications['api-key'];
    apiKey.apiKey = process.env.SENDINBLUE_KEY;
    // Configure API key authorization: partner-key
    const partnerKey = this.client.authentications['partner-key'];
    partnerKey.apiKey = process.env.SENDINBLUE_KEY;
  }

  public async sendTemplateEmail(templateId: number, to: [any], params: any = {}, sender: any = { name: 'ShipRank', address: 'noreply@shiprank.com' }) {
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

  public static getInstance(): Sendinblue {
    if (!Sendinblue.instance) {
      Sendinblue.instance = new Sendinblue();
    }
    return Sendinblue.instance;
  }
}

export default Sendinblue;
