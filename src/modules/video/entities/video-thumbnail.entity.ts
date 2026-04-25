import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Video } from './video.entity';

@Entity('video_thumbnails')
export class VideoThumbnail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Video, (video) => video.thumbnails)
  video: Video;

  @Column()
  videoId: string;

  @Column()
  interval: number;

  @Column()
  spritePath: string;

  @Column()
  vttPath: string;

  @CreateDateColumn()
  createdAt: Date;
}
