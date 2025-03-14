import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { BookmarkList } from './BookmarkList';
import { Post } from './posts';

@Entity()
@Index('IDX_bookmark_userId_createdAt', { synchronize: false })
export class Bookmark {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  listId: string;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne(() => BookmarkList, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  list: Promise<BookmarkList>;

  @Column({ default: () => 'now()' })
  @Index('IDX_bookmark_createdAt', { synchronize: false })
  createdAt: Date;
}
