import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Video } from './entities/video.entity';
import { VideoRendition } from './entities/video-rendition.entity';
import { VideoThumbnail } from './entities/video-thumbnail.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { WatchHistory } from './entities/watch-history.entity';
import { WatchLater } from './entities/watch-later.entity';
import { PlaylistController } from './playlist.controller';
import { BullModule } from '@nestjs/bullmq';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, VideoRendition, VideoThumbnail, Comment, Like, Playlist, PlaylistVideo, WatchHistory, WatchLater]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    UserModule,
  ],
  controllers: [VideoController, PlaylistController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
