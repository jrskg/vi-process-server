import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Video } from './video.entity';

@Entity('video_renditions')
export class VideoRendition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Video, (video) => video.renditions)
  video: Video;

  @Column()
  videoId: string;

  @Column()
  resolution: string;

  @Column({ nullable: true })
  width: number;

  @Column({ nullable: true })
  height: number;

  @Column({ nullable: true })
  bitrate: string;

  @Column()
  playlistPath: string;

  @Column({ default: false })
  isReady: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
