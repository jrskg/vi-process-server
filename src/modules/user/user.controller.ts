import { Controller, Post, Delete, Param, UseGuards, Request, Get, Put, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { NotificationService } from './notification.service';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(
    @Request() req,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.userService.update(req.user.id, body, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/subscribe')
  async subscribe(@Param('id') id: string, @Request() req) {
    const result = await this.userService.subscribe(req.user.id, id);
    // Notify the channel owner
    await this.notificationService.create(
      id, 
      'new_subscriber', 
      `${req.user.username} subscribed to your channel!`,
      `/profile/${req.user.id}`
    );
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/subscribe')
  async unsubscribe(@Param('id') id: string, @Request() req) {
    return this.userService.unsubscribe(req.user.id, id);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/notifications')
  async getNotifications(@Request() req) {
    return this.notificationService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/notifications/:id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/notifications/read-all')
  async markAllAsRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id);
  }
}
