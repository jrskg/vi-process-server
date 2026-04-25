import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum NotificationType {
  VIDEO_READY = 'video_ready',
  NEW_SUBSCRIBER = 'new_subscriber',
  NEW_COMMENT = 'new_comment',
  NEW_LIKE = 'new_like',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'varchar',
  })
  type: NotificationType;

  @Column()
  message: string;

  @Column({ nullable: true })
  link: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
