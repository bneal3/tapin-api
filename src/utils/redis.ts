import * as API from 'ioredis';
import Logger from './logger';

export enum RedisPrefix {}

class Redis {
  private static instance: Redis;
  public api = API;
  public client = new API(process.env.REDISCLOUD_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
   });
  public publisher = new API(process.env.REDISCLOUD_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
   });
  public subscriber = new API(process.env.REDISCLOUD_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
   });

  constructor() {
    this.client.on('connect', function () { Logger.getInstance().logger.debug('Client connected to redis'); });
    this.publisher.on('connect', function () { Logger.getInstance().logger.debug('Publisher connected to redis'); });
    this.subscriber.on('connect', function () { Logger.getInstance().logger.debug('Subscriber connected to redis'); });
    this.client.on("error", function (err) { Logger.getInstance().logger.error('Error with client redis connection', { metadata: err }); });
    this.publisher.on("error", function (err) { Logger.getInstance().logger.error('Error with publisher redis connection', { metadata: err }); });
    this.subscriber.on("error", function (err) { Logger.getInstance().logger.error('Error with subscriber redis connection', { metadata: err }); });
  }

  public async set(key: string, value: string, expiry?: number): Promise<Error | string> {
    return new Promise<Error | string>((resolve, reject) => {
      const callback = (err: Error, result: string) => {
        if(err) {
          Logger.getInstance().logger.error('Error setting redis key', { metadata: err });
          reject(err);
        } else {
          resolve(result);
        }
      };
      if(expiry) {
        this.client.set(key, value, 'EX', expiry, callback);
      } else {
        this.client.set(key, value, callback);
      }
    });
  }

  public async get(key: string): Promise<Error | string> {
    return new Promise<Error | string>((resolve, reject) => {
      this.client.get(key, (err: Error, result: string) => {
        if(err) {
          Logger.getInstance().logger.error('Error getting redis key', { metadata: err });
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  public async delete(key: string): Promise<Error | number> {
    return new Promise<Error | number>((resolve, reject) => {
      resolve(this.client.del(key));
    });
  }

  public static getInstance(): Redis {
    if(!Redis.instance) {
      Redis.instance = new Redis();
    }
    return Redis.instance;
  }
}

export default Redis;
