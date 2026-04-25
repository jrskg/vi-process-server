import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like as TypeOrmLike } from 'typeorm';
import { Video, VideoStatus } from './entities/video.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { WatchHistory } from './entities/watch-history.entity';
import { WatchLater } from './entities/watch-later.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../user/notification.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(PlaylistVideo)
    private playlistVideoRepository: Repository<PlaylistVideo>,
    @InjectRepository(WatchHistory)
    private watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(WatchLater)
    private watchLaterRepository: Repository<WatchLater>,
    private notificationService: NotificationService,
    @InjectQueue('video-processing')
    private videoQueue: Queue,
    private configService: ConfigService,
  ) {}

  async create(title: string, description: string, file: Express.Multer.File, thumbFile: Express.Multer.File | undefined, userId: string, playlistId?: string): Promise<Video> {
    const rawDir = this.configService.get('storage.disk.raw');
    const thumbDir = this.configService.get('storage.disk.thumbnails');
    
    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

    const filename = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(rawDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    let customThumbnailPath: string | undefined;
    if (thumbFile) {
      const thumbFilename = `${Date.now()}-${thumbFile.originalname}`;
      const thumbPath = path.join(thumbDir, thumbFilename);
      fs.writeFileSync(thumbPath, thumbFile.buffer);
      customThumbnailPath = `thumbnails/${thumbFilename}`;
    }

    const video = this.videoRepository.create({
      title,
      description,
      status: VideoStatus.PENDING,
      rawVideoPath: filePath,
      customThumbnailPath,
      userId,
    });

    const savedVideo = await this.videoRepository.save(video);

    if (playlistId) {
      await this.playlistVideoRepository.save({
        playlistId,
        videoId: savedVideo.id,
      });
    }

    await this.videoQueue.add('process-metadata', {
      videoId: savedVideo.id,
      filePath: savedVideo.rawVideoPath,
    });

    return savedVideo;
  }

  async importYoutube(title: string, description: string, youtubeUrl: string, userId: string): Promise<Video> {
    const video = this.videoRepository.create({
      title,
      description,
      status: VideoStatus.PENDING,
      userId,
    });

    const savedVideo = await this.videoRepository.save(video);

    await this.videoQueue.add('import-youtube', {
      videoId: savedVideo.id,
      youtubeUrl,
    });

    return savedVideo;
  }

  async findAllPublic(search?: string): Promise<Video[]> {
    const where: any = { isPublic: true, status: VideoStatus.READY };
    if (search) {
      where.title = TypeOrmLike(`%${search}%`);
    }
    return this.videoRepository.find({
      where,
      relations: ['user', 'likes', 'comments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUsers(userIds: string[]): Promise<Video[]> {
    return this.videoRepository.find({
      where: { userId: In(userIds), isPublic: true, status: VideoStatus.READY },
      relations: ['user', 'likes', 'comments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOwner(userId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { userId },
      relations: ['renditions', 'thumbnails'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['renditions', 'thumbnails', 'user', 'comments', 'comments.user', 'likes'],
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    return video;
  }

  async getSuggestions(videoId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { id: TypeOrmLike(`not:${videoId}`), isPublic: true, status: VideoStatus.READY },
      relations: ['user', 'likes'],
      take: 10,
      order: { createdAt: 'DESC' },
    });
  }

  async searchYoutube(query: string, page: number = 1): Promise<any[]> {
    const ytDlpPath = path.join(process.cwd(), 'yt-dlp');
    const { exec } = require('child_process');
    const pageSize = 12;
    const start = (page - 1) * pageSize + 1;
    const end = page * pageSize;
    
    return new Promise((resolve) => {
      const cmd = `"${ytDlpPath}" "ytsearch${end}:${query}" --playlist-start ${start} --playlist-end ${end} --dump-json --no-check-certificate --flat-playlist --extractor-args "youtube:player_client=android"`;
      
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err) {
          console.error('Youtube search error:', err);
          return resolve([]);
        }

        const results = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              const data = JSON.parse(line);
              return {
                id: data.id,
                title: data.title,
                description: data.description,
                thumbnail: data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${data.id}/mqdefault.jpg`,
                duration: data.duration,
                uploaderName: data.uploader,
                views: data.view_count,
                url: data.url || `https://www.youtube.com/watch?v=${data.id}`
              };
            } catch (e) {
              return null;
            }
          })
          .filter(v => v !== null);
        
        resolve(results);
      });
    });
  }

  async addComment(videoId: string, userId: string, text: string) {
    const comment = this.commentRepository.create({ videoId, userId, text });
    const saved = await this.commentRepository.save(comment);
    
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (video && video.userId !== userId) {
      await this.notificationService.create(
        video.userId,
        'new_comment',
        `Someone commented on your video "${video.title}"`,
        `/video/${video.id}`
      );
    }
    return saved;
  }

  async toggleLike(videoId: string, userId: string) {
    const existing = await this.likeRepository.findOne({ where: { videoId, userId } });
    const video = await this.videoRepository.findOneBy({ id: videoId });
    
    if (existing) {
      await this.likeRepository.remove(existing);
      return { liked: false };
    } else {
      const like = this.likeRepository.create({ videoId, userId });
      await this.likeRepository.save(like);
      
      if (video && video.userId !== userId) {
        await this.notificationService.create(
          video.userId,
          'new_like',
          `Someone liked your video "${video.title}"`,
          `/video/${video.id}`
        );
      }
      return { liked: true };
    }
  }

  async updateVisibility(id: string, userId: string, isPublic: boolean) {
    const video = await this.videoRepository.findOneBy({ id, userId });
    if (!video) throw new NotFoundException('Video not found or unauthorized');
    video.isPublic = isPublic;
    return this.videoRepository.save(video);
  }

  async delete(id: string, userId: string) {
    const video = await this.videoRepository.findOneBy({ id, userId });
    if (!video) throw new NotFoundException('Video not found or unauthorized');
    return this.videoRepository.remove(video);
  }

  async trackWatch(videoId: string, userId: string) {
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) return;

    let history = await this.watchHistoryRepository.findOne({ where: { videoId, userId } });
    if (history) {
      history.watchedAt = new Date();
      return this.watchHistoryRepository.save(history);
    }
    history = this.watchHistoryRepository.create({ videoId, userId });
    return this.watchHistoryRepository.save(history);
  }

  async getWatchHistory(userId: string): Promise<Video[]> {
    const history = await this.watchHistoryRepository.find({
      where: { userId },
      relations: ['video', 'video.user', 'video.likes'],
      order: { watchedAt: 'DESC' },
    });
    
    const uniqueVideos: Video[] = [];
    const seenIds = new Set<string>();
    
    for (const h of history) {
      if (h.video && !seenIds.has(h.video.id)) {
        uniqueVideos.push(h.video);
        seenIds.add(h.video.id);
      }
      if (uniqueVideos.length >= 20) break;
    }
    
    return uniqueVideos;
  }

  async getLikedVideos(userId: string): Promise<Video[]> {
    const likes = await this.likeRepository.find({
      where: { userId },
      relations: ['video', 'video.user', 'video.likes'],
      order: { id: 'DESC' },
    });
    return likes.map(l => l.video);
  }

  async toggleWatchLater(videoId: string, userId: string) {
    const existing = await this.watchLaterRepository.findOne({ where: { videoId, userId } });
    if (existing) {
      await this.watchLaterRepository.remove(existing);
      return { added: false };
    } else {
      await this.watchLaterRepository.save({ videoId, userId });
      return { added: true };
    }
  }

  async getWatchLater(userId: string): Promise<Video[]> {
    const list = await this.watchLaterRepository.find({
      where: { userId },
      relations: ['video', 'video.user', 'video.likes'],
      order: { createdAt: 'DESC' },
    });
    return list.map(item => item.video);
  }
}
