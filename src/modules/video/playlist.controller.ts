import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, Put, NotFoundException, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from '../video/entities/playlist.entity';
import { PlaylistVideo } from '../video/entities/playlist-video.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('playlists')
export class PlaylistController {
  constructor(
    @InjectRepository(Playlist)
    private playlistRepo: Repository<Playlist>,
    @InjectRepository(PlaylistVideo)
    private playlistVideoRepo: Repository<PlaylistVideo>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any, @Request() req) {
    const playlist = this.playlistRepo.create({
      ...body,
      userId: req.user.id,
    });
    return this.playlistRepo.save(playlist);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req) {
    return this.playlistRepo.find({
      where: { userId: req.user.id },
      relations: ['playlistVideos', 'playlistVideos.video'],
      order: { updatedAt: 'DESC' }
    });
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.playlistRepo.find({
      where: { userId, isPublic: true },
      relations: ['playlistVideos', 'playlistVideos.video'],
      order: { updatedAt: 'DESC' }
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const playlist = await this.playlistRepo.findOne({
      where: { id },
      relations: ['playlistVideos', 'playlistVideos.video', 'playlistVideos.video.user'],
    });
    if (!playlist) throw new NotFoundException();
    return playlist;
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req) {
    const playlist = await this.playlistRepo.findOneBy({ id, userId: req.user.id });
    if (!playlist) throw new NotFoundException();
    
    if (body.name) playlist.name = body.name;
    if (typeof body.isPublic === 'boolean') playlist.isPublic = body.isPublic;
    if (body.description) playlist.description = body.description;

    return this.playlistRepo.save(playlist);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/videos')
  async addVideo(@Param('id') id: string, @Body('videoId') videoId: string) {
    const pv = this.playlistVideoRepo.create({
      playlistId: id,
      videoId,
    });
    return this.playlistVideoRepo.save(pv);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/videos/:videoId')
  async removeVideo(@Param('id') id: string, @Param('videoId') videoId: string) {
    return this.playlistVideoRepo.delete({ playlistId: id, videoId });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    return this.playlistRepo.delete({ id, userId: req.user.id });
  }
}
