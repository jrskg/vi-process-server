import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Video } from './video.entity';

@Entity('likes')
@Unique(['userId', 'videoId'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.likes)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Video, (video) => video.likes)
  video: Video;

  @Column()
  videoId: string;
}
