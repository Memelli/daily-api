import { User } from './../entity/User';
import { Comment, Post } from '../entity';
import { DataSource } from 'typeorm';

const defaultUrls =
  process.env.DEFAULT_IMAGE_URL ??
  'https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/1,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/2,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/3,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/4,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/5,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/6,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/7,https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/8';
export const defaultImage = {
  urls: defaultUrls.split(','),
  ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
  placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
};

export const pickImageUrl = (post: {
  createdAt: Date | string | number;
}): string =>
  defaultImage.urls[
    Math.floor(new Date(post.createdAt).getTime() / 1000) %
      defaultImage.urls.length
  ];

interface PostCommentersProps {
  limit?: number;
  userId?: string;
}

export const getPostCommenterIds = async (
  con: DataSource,
  postId: string,
  { userId, limit = 4 }: PostCommentersProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(Comment)
    .createQueryBuilder('c')
    .select(`DISTINCT c."userId"`)
    .innerJoin(User, 'u', 'u.id = c."userId"')
    .where('c."postId" = :postId', { postId })
    .andWhere('u.username IS NOT NULL');

  if (userId) {
    queryBuilder = queryBuilder.andWhere('c."userId" != :userId', { userId });
  }

  if (limit) {
    queryBuilder = queryBuilder.limit(limit);
  }

  const result = await queryBuilder.getRawMany<Comment>();

  return result.map((comment) => comment.userId);
};

export const hasAuthorScout = (post: Post): boolean =>
  !!post?.authorId || !!post?.scoutId;
