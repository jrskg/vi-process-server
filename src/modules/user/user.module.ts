import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import { Notification } from './entities/notification.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription, Notification]),
    JwtModule.register({
      secret: 'super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [UserService, NotificationGateway, NotificationService],
  controllers: [UserController],
  exports: [UserService, NotificationService],
})
export class UserModule {}
