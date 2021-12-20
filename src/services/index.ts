import AuthenticationService from './authentication.service';
import MeetingService from './meeting.service';
import ScoreService from './score.service';
import UserService from './user.service';

const authenticationService = AuthenticationService.getInstance();
const meetingService = MeetingService.getInstance();
const scoreService = ScoreService.getInstance();
const userService = UserService.getInstance();

export {
    authenticationService, meetingService, scoreService, userService
}
