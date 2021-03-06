import { User } from '../models/user';
import { UserAction } from '../models/user-action';

export interface Upvote extends UserAction {
  id: number;
  user: User;
  upvotable_id: number;
  upvotable_type: string;
}
