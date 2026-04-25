import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like as TypeOrmLike } from 'typeorm';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private configService: ConfigService,
  ) {}

  async update(id: string, data: any, file?: Express.Multer.File): Promise<User> {
    const user = await this.findOne(id);
    
    if (file) {
      const avatarDir = path.join(this.configService.get<string>('storage.disk.basePath')!, 'avatars');
      if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
      
      const filename = `${id}-${Date.now()}${path.extname(file.originalname)}`;
      fs.writeFileSync(path.join(avatarDir, filename), file.buffer);
      user.avatarUrl = `storage/avatars/${filename}`;
    }

    if (data.fullName) user.fullName = data.fullName;
    if (data.bio) user.bio = data.bio;
    if (data.channelName) user.channelName = data.channelName;

    return this.userRepository.save(user);
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findOneByUsernameOrEmail(username: string, email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [{ username }, { email }],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['following', 'followers']
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async subscribe(followerId: string, followingId: string) {
    const sub = this.subscriptionRepository.create({ followerId, followingId });
    return this.subscriptionRepository.save(sub);
  }

  async unsubscribe(followerId: string, followingId: string) {
    return this.subscriptionRepository.delete({ followerId, followingId });
  }

  async getSubscribedChannelIds(followerId: string): Promise<string[]> {
    const subs = await this.subscriptionRepository.find({
      where: { followerId },
    });
    return subs.map(s => s.followingId);
  }

  async searchChannels(query: string): Promise<User[]> {
    return this.userRepository.find({
      where: [
        { username: TypeOrmLike(`%${query}%`) },
        { fullName: TypeOrmLike(`%${query}%`) },
      ],
      relations: ['followers'],
    });
  }
}
