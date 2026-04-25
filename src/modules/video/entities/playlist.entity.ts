import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PlaylistVideo } from './playlist-video.entity';

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ nullable: true })
  thumbnailPath: string;

  @ManyToOne(() => User, (user) => user.playlists)
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => PlaylistVideo, (pv) => pv.playlist)
  playlistVideos: PlaylistVideo[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
