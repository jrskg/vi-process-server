import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from '../video/entities/video.entity';
import { VideoRendition } from '../video/entities/video-rendition.entity';
import { VideoThumbnail } from '../video/entities/video-thumbnail.entity';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationService } from '../user/notification.service';

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(VideoRendition)
    private renditionRepository: Repository<VideoRendition>,
    @InjectRepository(VideoThumbnail)
    private thumbnailRepository: Repository<VideoThumbnail>,
    @InjectQueue('video-processing')
    private videoQueue: Queue,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`[Worker] Started job: ${job.name} (ID: ${job.id})`);
    switch (job.name) {
      case 'import-youtube':
        return this.handleYoutubeImport(job);
      case 'process-metadata':
        return this.handleMetadata(job);
      case 'transcode':
        return this.handleTranscode(job);
      case 'generate-master-playlist':
        return this.handleMasterPlaylist(job);
      case 'generate-thumbnails':
        return this.handleThumbnails(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleYoutubeImport(job: Job<{ videoId: string; youtubeUrl: string }>) {
    let { videoId, youtubeUrl } = job.data;
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) throw new Error('Video not found');

    try {
      const url = new URL(youtubeUrl);
      youtubeUrl = `${url.origin}${url.pathname}?v=${url.searchParams.get('v') || url.pathname.split('/').pop()}`;
    } catch (e) {}

    const rawDir = this.configService.get('storage.disk.raw');
    const filename = `${Date.now()}-youtube-${videoId}.mp4`;
    const filePath = path.join(rawDir, filename);
    const ytDlpPath = path.join(process.cwd(), 'yt-dlp');

    console.log(`[Youtube] Downloading sanitized URL: ${youtubeUrl}`);

    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const cmd = `"${ytDlpPath}" --no-check-certificate --extractor-args "youtube:player_client=android" -f "best[ext=mp4]/best" --merge-output-format mp4 -o "${filePath}" "${youtubeUrl}"`;
      
      exec(cmd, async (error, stdout, stderr) => {
        if (error) {
          console.error(`[Youtube] Download error: ${error.message}`);
          video.status = VideoStatus.FAILED;
          await this.videoRepository.save(video);
          return reject(error);
        }

        console.log(`[Youtube] Downloaded successfully: ${filename}`);
        video.rawVideoPath = filePath;
        video.status = VideoStatus.PROCESSING;
        video.progress = 5;
        await this.videoRepository.save(video);

        await this.videoQueue.add('process-metadata', {
          videoId,
          filePath,
        });

        resolve(true);
      });
    });
  }

  private async handleMetadata(job: Job<{ videoId: string; filePath: string }>) {
    const { videoId, filePath } = job.data;
    console.log(`[Metadata] Extracting info for ${videoId}...`);
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) throw new Error('Video not found');

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, async (err, metadata) => {
        if (err) return reject(err);

        video.duration = metadata.format.duration || 0;
        video.status = VideoStatus.PROCESSING;
        video.progress = 10;
        await this.videoRepository.save(video);
        console.log(`[Metadata] Done. Duration: ${video.duration}s. Next: 240p transcode.`);

        const resolutions = this.configService.get<any[]>('video.resolutions')!;
        const lowRes = resolutions[0];

        await this.videoQueue.add('transcode', {
          videoId,
          filePath,
          resolution: lowRes,
          isCritical: true,
        });

        resolve(metadata);
      });
    });
  }

  private async handleTranscode(job: Job<{ videoId: string; filePath: string; resolution: any; isCritical: boolean }>) {
    const { videoId, filePath, resolution, isCritical } = job.data;
    console.log(`[Transcode] Processing ${resolution.name} for ${videoId}...`);
    const hlsBase = this.configService.get<string>('storage.disk.hls')!;
    const hlsDir = path.join(hlsBase, videoId, resolution.name);
    
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    const playlistPath = path.join(hlsDir, 'playlist.m3u8');

    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions([
          '-profile:v baseline',
          '-level 3.0',
          `-s ${resolution.width}x${resolution.height}`,
          `-b:v ${resolution.bitrate}`,
          '-start_number 0',
          '-hls_time 10',
          '-hls_list_size 0',
          '-f hls',
        ])
        .output(playlistPath)
        .on('end', async () => {
          console.log(`[Transcode] Finished ${resolution.name} for ${videoId}`);
          
          const videoExists = await this.videoRepository.findOneBy({ id: videoId });
          if (!videoExists) return resolve(false);

          const rendition = this.renditionRepository.create({
            videoId,
            resolution: resolution.name,
            width: resolution.width,
            height: resolution.height,
            bitrate: resolution.bitrate,
            playlistPath,
            isReady: true,
          });
          await this.renditionRepository.save(rendition);

          const video = await this.videoRepository.findOne({ 
            where: { id: videoId },
            relations: ['renditions']
          });
          if (!video) return resolve(false);

          const allResolutions = this.configService.get<any[]>('video.resolutions')!;
          const baseProgress = 10;
          const resolutionProgressStep = 70 / allResolutions.length;
          video.progress = Math.round(baseProgress + (video.renditions.length * resolutionProgressStep));

          if (isCritical) {
            video.status = VideoStatus.PARTIALLY_READY;
            await this.videoRepository.save(video);
            
            const remainingResolutions = allResolutions.slice(1);
            for (const res of remainingResolutions) {
              await this.videoQueue.add('transcode', {
                videoId,
                filePath,
                resolution: res,
                isCritical: false,
              });
            }

            await this.videoQueue.add('generate-thumbnails', { videoId, filePath });
          } else {
            await this.videoRepository.save(video);
          }

          if (video.renditions.length === allResolutions.length) {
            await this.videoQueue.add('generate-master-playlist', { videoId });
          }

          resolve(true);
        })
        .on('error', (err) => {
          console.error(`[Transcode] Error for ${resolution.name}:`, err);
          reject(err);
        })
        .run();
    });
  }

  private async handleMasterPlaylist(job: Job<{ videoId: string }>) {
    const { videoId } = job.data;
    console.log(`[Master] Generating master playlist for ${videoId}...`);
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['renditions'],
    });

    if (!video) return;

    const hlsBase = this.configService.get<string>('storage.disk.hls')!;
    const hlsDir = path.join(hlsBase, videoId);
    const masterPath = path.join(hlsDir, 'master.m3u8');

    let content = '#EXTM3U\n#EXT-X-VERSION:3\n';
    for (const rendition of video.renditions) {
      const relativePath = `${rendition.resolution}/playlist.m3u8`;
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(rendition.bitrate) * 1000},RESOLUTION=${rendition.width}x${rendition.height}\n${relativePath}\n`;
    }

    fs.writeFileSync(masterPath, content);
    video.hlsMasterPath = masterPath;
    video.status = VideoStatus.READY;
    video.progress = 100;
    await this.videoRepository.save(video);
    
    // Notify user
    await this.notificationService.create(
      video.userId,
      'video_ready',
      `Your video "${video.title}" is ready to watch!`,
      `/video/${video.id}`
    );
  }

  private async handleThumbnails(job: Job<{ videoId: string; filePath: string }>) {
    const { videoId, filePath } = job.data;
    console.log(`[Thumbnails] Generating for ${videoId}...`);
    const thumbBase = this.configService.get<string>('storage.disk.thumbnails')!;
    const thumbDir = path.join(thumbBase, videoId);
    
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) throw new Error('Video not found');

    const interval = this.configService.get<number>('video.thumbnailInterval')!;
    const grid = this.configService.get<any>('video.thumbnailGrid')!;

    return new Promise((resolve, reject) => {
      const spritePath = path.join(thumbDir, 'sprite.png');
      const vttPath = path.join(thumbDir, 'preview.vtt');

      ffmpeg(filePath)
        .complexFilter([
          `fps=1/${interval},scale=${grid.width}:${grid.height},tile=${grid.cols}x${grid.rows}`
        ])
        .output(spritePath)
        .frames(1)
        .on('end', async () => {
          let vttContent = 'WEBVTT\n\n';
          for (let i = 0; i < (grid.cols * grid.rows); i++) {
            const startTime = i * interval;
            const endTime = (i + 1) * interval;
            const x = (i % grid.cols) * grid.width;
            const y = Math.floor(i / grid.cols) * grid.height;
            
            vttContent += `${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n`;
            vttContent += `sprite.png#xywh=${x},${y},${grid.width},${grid.height}\n\n`;
          }
          fs.writeFileSync(vttPath, vttContent);

          const videoExists = await this.videoRepository.findOneBy({ id: videoId });
          if (!videoExists) return resolve(false);

          const thumbnail = this.thumbnailRepository.create({            
            videoId,
            interval,
            spritePath: `thumbnails/${videoId}/sprite.png`,
            vttPath: `thumbnails/${videoId}/preview.vtt`,
          });
          await this.thumbnailRepository.save(thumbnail);
          
          const updates: any = { thumbnailVttPath: `thumbnails/${videoId}/preview.vtt` };
          
          if (!video.customThumbnailPath) {
            const mainThumbName = `thumb-main.png`;
            await new Promise((res) => {
              ffmpeg(filePath)
                .screenshots({
                  count: 1,
                  folder: thumbDir,
                  filename: mainThumbName,
                  timestamps: ['1'],
                  size: `${grid.width}x${grid.height}`
                })
                .on('end', res)
                .on('error', res);
            });
            updates.customThumbnailPath = `thumbnails/${videoId}/${mainThumbName}`;
          }

          await this.videoRepository.update(videoId, updates);
          resolve(true);
        })
        .on('error', (err) => {
          console.error(`[Thumbnails] Error:`, err);
          reject(err);
        })
        .run();
    });
  }

  private formatTime(seconds: number): string {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8) + '.000';
  }
}
