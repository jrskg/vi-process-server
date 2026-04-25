import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Video } from './video.entity';

@Entity('watch_later')
@Unique(['userId', 'videoId'])
export class WatchLater {
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
  createdAt: Date;
}
