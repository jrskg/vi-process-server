import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VideoProcessor } from './video.processor';
import { VideoModule } from '../video/video.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../video/entities/video.entity';
import { VideoRendition } from '../video/entities/video-rendition.entity';
import { VideoThumbnail } from '../video/entities/video-thumbnail.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, VideoRendition, VideoThumbnail]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    UserModule,
  ],
  providers: [VideoProcessor],
})
export class QueueModule {}
