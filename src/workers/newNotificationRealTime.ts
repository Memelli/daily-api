import { messageToJson, Worker } from './worker';
import { redisPubSub } from '../redis';
import { ChangeObject } from '../types';
import { getNotificationAndChildren, Notification } from '../entity';

interface Data {
  notification: ChangeObject<Notification>;
}

const worker: Worker = {
  subscription: 'api.new-notification-real-time',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    if (!data.notification.public) {
      return;
    }
    try {
      const { id } = data.notification;
      const [notification, attachments, avatars] =
        await getNotificationAndChildren(con, id);
      if (notification) {
        await redisPubSub.publish(
          `events.notifications.${notification.userId}.new`,
          {
            ...notification,
            attachments,
            avatars,
          },
        );
      }
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send new notification event to redis',
      );
      throw err;
    }
  },
};

export default worker;
