import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { VideoRendition } from './video-rendition.entity';
import { VideoThumbnail } from './video-thumbnail.entity';
import { User } from '../../user/entities/user.entity';
import { Comment } from './comment.entity';
import { Like } from './like.entity';

export enum VideoStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARTIALLY_READY = 'partially_ready',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    default: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @Column({ type: 'float', nullable: true })
  duration: number;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ nullable: true })
  rawVideoPath: string;

  @Column({ nullable: true })
  hlsMasterPath: string;

  @Column({ nullable: true })
  customThumbnailPath: string;

  @Column({ nullable: true })
  thumbnailVttPath: string;

  @ManyToOne(() => User, (user) => user.videos)
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => VideoRendition, (rendition) => rendition.video)
  renditions: VideoRendition[];

  @OneToMany(() => VideoThumbnail, (thumbnail) => thumbnail.video)
  thumbnails: VideoThumbnail[];

  @OneToMany(() => Comment, (comment) => comment.video)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.video)
  likes: Like[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
