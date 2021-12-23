import * as API from 'bull';

import Redis from './redis';
import { EventEmitter } from 'events';

class Bull {
  private static instance: Bull;
  public queues: API.Queue[] = [];

  constructor() {}

  public createClient(type: string) {
    switch (type) {
      case 'client':
        return Redis.getInstance().publisher;
      case 'subscriber':
        return Redis.getInstance().subscriber;
      default:
        return new (Redis.getInstance()).api(process.env.REDISCLOUD_URL);
    }
  }

  public get(name: string, options: API.QueueOptions, processor: any) {
    if(this.queues.length + 6 >= EventEmitter.defaultMaxListeners) {
      EventEmitter.defaultMaxListeners += ((this.queues.length + 6) - EventEmitter.defaultMaxListeners) + 1;
    }
    let queue = this.queues.filter((queue) => { return queue.name === name; });
    if(queue.length === 0) {
      const created = new API(name, process.env.REDISCLOUD_URL, options);
      created.process(processor);
      this.queues.push(created);
      queue = [created];
    }
    return queue[0];
  }

  public static getInstance(): Bull {
    if (!Bull.instance) {
      Bull.instance = new Bull();
    }
    return Bull.instance;
  }
}

export default Bull;
