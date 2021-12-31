import AuthenticationService from './authentication.service';
import MeetingService from './meeting.service';
import RelationshipService from './relationship.service';
import UserService from './user.service';

const authenticationService = AuthenticationService.getInstance();
const meetingService = MeetingService.getInstance();
const relationshipService = RelationshipService.getInstance();
const userService = UserService.getInstance();

export {
    authenticationService, meetingService, relationshipService, userService
}
