import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Video } from '../../video/entities/video.entity';
import { Comment } from '../../video/entities/comment.entity';
import { Like } from '../../video/entities/like.entity';
import { Subscription } from './subscription.entity';
import { Playlist } from '../../video/entities/playlist.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  channelName: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @OneToMany(() => Video, (video) => video.user)
  videos: Video[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Subscription, (sub) => sub.follower)
  following: Subscription[];

  @OneToMany(() => Subscription, (sub) => sub.following)
  followers: Subscription[];

  @OneToMany(() => Playlist, (playlist) => playlist.user)
  playlists: Playlist[];

  @CreateDateColumn()
  createdAt: Date;
}
