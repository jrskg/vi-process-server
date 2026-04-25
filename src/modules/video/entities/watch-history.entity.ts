import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Video } from './video.entity';

@Entity('watch_history')
export class WatchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Video)
  video: Video;

  @Column()
  videoId: string;

  @CreateDateColumn()
  watchedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
