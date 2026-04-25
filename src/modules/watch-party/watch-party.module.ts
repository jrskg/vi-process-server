import { Module } from '@nestjs/common';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyService } from './watch-party.service';
import { JwtModule } from '@nestjs/jwt';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    VideoModule,
  ],
  providers: [WatchPartyGateway, WatchPartyService],
})
export class WatchPartyModule {}
