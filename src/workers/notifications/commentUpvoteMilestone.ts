import { messageToJson } from '../worker';
import { Comment, CommentUpvote } from '../../entity';
import {
  NotificationCommentContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { buildPostContext, UPVOTE_MILESTONES } from './utils';

interface Data {
  userId: string;
  commentId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.comment-upvote-milestone-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const comment = await con
      .getRepository(Comment)
      .findOne({ where: { id: data.commentId } });
    if (
      !comment ||
      comment.userId === data.userId ||
      !UPVOTE_MILESTONES.includes(comment.upvotes.toString())
    ) {
      return;
    }
    const postCtx = await buildPostContext(con, comment.postId);
    if (!postCtx) {
      return;
    }
    const upvotes = await con.getRepository(CommentUpvote).find({
      where: { commentId: comment.id },
      take: 5,
      order: { createdAt: 'desc' },
      relations: ['user'],
    });
    const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));
    const ctx: NotificationCommentContext & NotificationUpvotersContext = {
      ...postCtx,
      comment,
      upvoters,
      upvotes: comment.upvotes,
      userId: comment.userId,
    };
    return [{ type: 'comment_upvote_milestone', ctx }];
  },
};

export default worker;
