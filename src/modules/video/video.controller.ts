import { Controller, Post, Get, Param, UploadedFiles, UseInterceptors, Body, UseGuards, Request, Query, Delete, Put } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from '../user/user.service';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly userService: UserService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]))
  async upload(
    @UploadedFiles() files: { video?: Express.Multer.File[], thumbnail?: Express.Multer.File[] },
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('playlistId') playlistId: string,
    @Request() req
  ) {
    const videoFile = files.video?.[0];
    const thumbFile = files.thumbnail?.[0];
    if (!videoFile) throw new Error('Video file is required');
    
    return this.videoService.create(title, description, videoFile, thumbFile, req.user.id, playlistId);
  }

  @Post('import-youtube')
  @UseGuards(JwtAuthGuard)
  async importYoutube(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('youtubeUrl') youtubeUrl: string,
    @Request() req
  ) {
    return this.videoService.importYoutube(title, description, youtubeUrl, req.user.id);
  }

  @Get('youtube/search')
  async searchYoutube(@Query('q') query: string, @Query('page') page: number) {
    return this.videoService.searchYoutube(query, page || 1);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(@Request() req) {
    const followingIds = await this.userService.getSubscribedChannelIds(req.user.id);
    if (followingIds.length === 0) {
      return this.videoService.findAllPublic();
    }
    return this.videoService.findByUsers(followingIds);
  }

  @Get('public')
  async getPublic(@Query('search') search: string) {
    const videos = await this.videoService.findAllPublic(search);
    let channels: any[] = [];
    if (search) {
      channels = await this.userService.searchChannels(search);
    }
    return { videos, channels };
  }

  @Get('my-videos')
  @UseGuards(JwtAuthGuard)
  async getMyVideos(@Request() req) {
    return this.videoService.findByOwner(req.user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req) {
    return this.videoService.getWatchHistory(req.user.id);
  }

  @Get('liked')
  @UseGuards(JwtAuthGuard)
  async getLiked(@Request() req) {
    return this.videoService.getLikedVideos(req.user.id);
  }

  @Get('watch-later')
  @UseGuards(JwtAuthGuard)
  async getWatchLater(@Request() req) {
    return this.videoService.getWatchLater(req.user.id);
  }

  @Post(':id/watch-later')
  @UseGuards(JwtAuthGuard)
  async toggleWatchLater(@Param('id') id: string, @Request() req) {
    return this.videoService.toggleWatchLater(id, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }

  @Post(':id/track')
  @UseGuards(JwtAuthGuard)
  async trackWatch(@Param('id') id: string, @Request() req) {
    return this.videoService.trackWatch(id, req.user.id);
  }

  @Get(':id/suggestions')
  async getSuggestions(@Param('id') id: string) {
    return this.videoService.getSuggestions(id);
  }

  @Post(':id/comment')
  @UseGuards(JwtAuthGuard)
  async comment(@Param('id') id: string, @Body('text') text: string, @Request() req) {
    return this.videoService.addComment(id, req.user.id, text);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async like(@Param('id') id: string, @Request() req) {
    return this.videoService.toggleLike(id, req.user.id);
  }

  @Put(':id/visibility')
  @UseGuards(JwtAuthGuard)
  async updateVisibility(@Param('id') id: string, @Body('isPublic') isPublic: boolean, @Request() req) {
    return this.videoService.updateVisibility(id, req.user.id, isPublic);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req) {
    return this.videoService.delete(id, req.user.id);
  }
}
