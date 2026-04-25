import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { Playlist } from './playlist.entity';
import { Video } from './video.entity';

@Entity('playlist_videos')
@Unique(['playlistId', 'videoId'])
export class PlaylistVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Playlist, (p) => p.playlistVideos, { onDelete: 'CASCADE' })
  playlist: Playlist;

  @Column()
  playlistId: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  video: Video;

  @Column()
  videoId: string;

  @Column({ default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;
}
