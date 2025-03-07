import { messageToJson } from '../worker';
import { Source, SourceRequest } from '../../entity';
import { NotificationSourceRequestContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { NotificationReason } from '../../common';
import { ChangeObject } from '../../types';

type Data = {
  reason: NotificationReason;
  sourceRequest: ChangeObject<SourceRequest>;
};

const worker: NotificationWorker = {
  subscription: 'api.source-request-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const ctx: NotificationSourceRequestContext = {
      userId: data.sourceRequest.userId,
      sourceRequest: data.sourceRequest,
    };
    switch (data.reason) {
      case NotificationReason.Publish: {
        const source = await con
          .getRepository(Source)
          .findOneBy({ id: data.sourceRequest.sourceId });
        return [{ type: 'source_approved', ctx: { ...ctx, source } }];
      }
      case NotificationReason.Decline:
      case NotificationReason.Exists: {
        return [{ type: 'source_rejected', ctx }];
      }
      default:
        return null;
    }
  },
};

export default worker;
