import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from './user.entity';

@Entity('subscriptions')
@Unique(['followerId', 'followingId'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.following)
  follower: User;

  @Column()
  followerId: string;

  @ManyToOne(() => User, (user) => user.followers)
  following: User;

  @Column()
  followingId: string;
}
