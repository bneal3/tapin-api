import * as mongoose from 'mongoose';

import { HttpException, NotAuthorizedException, ObjectAlreadyExistsException, ObjectNotFoundException, ServerProcessException, BadParametersException  } from '../utils/index';
import { AccessType } from '../interfaces/index';
import { RelationshipModel, Relationship, CreateRelationshipDto, UserModel, User } from '../models/index';
import { logger } from '../utils/index';
import { authenticationService, userService } from '../services/index';

class RelationshipService {
  private static instance: RelationshipService;
  private relationship = RelationshipModel;
  private user = UserModel;

  public getRelationships = async (user: (User & mongoose.Document), query: any) => {
    let ids: string[] = query.ids ?? [];
    let userIds: string[] = query.userIds ?? [];
    ids = ids.filter((id) => {
      if(mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
    });
    userIds = userIds.filter((userId: string) => {
      if(mongoose.Types.ObjectId.isValid(userId)) {
        return userId;
      }
    });
    // FLOW: Get relationships
    const relationships = await this.relationship.find({
      $or: [
        { _id: { $in: ids }},
        { userIds: { $in: userIds }}
      ]
    }).sort({ score: -1 }).catch((err: Error) => { return undefined; });
    console.log(relationships);
    if(relationships && relationships.length > 0) {
      const relationshipObjects: any[] = [];
      for(let i = 0; i < relationships.length; i++) {
        const contact = await this.user.findById(relationships[i].userIds.filter((userId: string) => { return userId !== user._id.toString(); })[0]);
        const relationshipObject: any = {
          ...relationships[i].toObject(),
          contact: contact
        };
        console.log(relationshipObject);
        relationshipObjects.push(relationshipObject);
      }
      console.log(relationshipObjects);
      return relationshipObjects;
    } else {
      throw new ObjectNotFoundException('identifier(s)');
    }
  }

  public createRelationship = async (user: (User & mongoose.Document), relationshipData: CreateRelationshipDto) => {
    let contact: (User & mongoose.Document);
    if(relationshipData.contactId) {
      contact = await this.user.findById(relationshipData.contactId);
    } else {
      if(relationshipData.email && relationshipData.name) {
        // FLOW: Check if user exists already
        contact = await this.user.findOne({
          email: relationshipData.email,
          $or: [
            { dateRegistered: { $exists: true }},
            { referrer: user._id }
          ]
        });
        if(!contact) {
          // FLOW: Create new user
          contact = await this.user.create({
            email: relationshipData.email,
            name: relationshipData.name,
            referrer: user._id
          });
        }
      }
    }
    // FLOW: Create new relationship
    let relationship = await this.relationship.findOne({ userIds: [user._id.toString(), contact._id.toString()] });
    if(!relationship) {
      relationship = await this.relationship.create({ userIds: [user._id.toString(), contact._id.toString()] });
      return relationship;
    } else {
      throw new ObjectAlreadyExistsException('Relationship', 'user');
    }
  }

  public static getInstance(): RelationshipService {
    if(!RelationshipService.instance) {
      RelationshipService.instance = new RelationshipService();
    }
    return RelationshipService.instance;
  }
}

export default RelationshipService;
