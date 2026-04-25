import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private gateway: NotificationGateway,
  ) {}

  async create(userId: string, type: string, message: string, link?: string) {
    const notification = this.notificationRepo.create({ userId, type: type as any, message, link });
    const saved = await this.notificationRepo.save(notification);
    this.gateway.sendToUser(userId, 'notification', saved);
    return saved;
  }

  async findAll(userId: string) {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.notificationRepo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update({ userId }, { isRead: true });
  }
}
