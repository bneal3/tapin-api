import App from './app';
import Logger from './utils/logger';
import { AuthenticationController, LogController, MeetingController, RelationshipController, UserController } from './controllers/index';

// FLOW: Instantiate app
const app = new App(
  [
    new AuthenticationController(),
    new LogController(),
    new MeetingController(),
    new RelationshipController(),
    new UserController()
  ]
);

// FLOW: Listen to server
app.listen();
