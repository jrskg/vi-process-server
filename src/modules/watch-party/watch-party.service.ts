import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface PartyState {
  roomId: string;
  roomName: string;
  videoId: string;
  videoTitle?: string;
  hostId: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
}

@Injectable()
export class WatchPartyService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
    });
  }

  private getRoomKey(roomId: string): string {
    return `watchparty:room:${roomId}`;
  }

  private getActivePartiesKey(): string {
    return `watchparty:active_rooms`;
  }

  async getPartyState(roomId: string): Promise<PartyState | null> {
    const data = await this.redis.get(this.getRoomKey(roomId));
    if (!data) return null;
    
    const state: PartyState = JSON.parse(data);
    
    if (state.isPlaying) {
      const now = Date.now();
      const elapsed = (now - state.lastUpdatedAt) / 1000;
      state.currentTime += elapsed;
    }
    
    return state;
  }

  async updatePartyState(roomId: string, state: Partial<PartyState>): Promise<PartyState> {
    const data = await this.redis.get(this.getRoomKey(roomId));
    const current = data ? JSON.parse(data) : {
      roomId,
      roomName: state.roomName || 'New Room',
      videoId: '',
      videoTitle: '',
      hostId: '',
      isPlaying: false,
      currentTime: 0,
      lastUpdatedAt: Date.now(),
    };

    const newState: PartyState = {
      ...current,
      ...state,
      lastUpdatedAt: Date.now(),
    };

    await this.redis.set(this.getRoomKey(roomId), JSON.stringify(newState), 'EX', 86400);
    await this.redis.sadd(this.getActivePartiesKey(), roomId);
    return newState;
  }

  async deletePartyState(roomId: string): Promise<void> {
    await this.redis.del(this.getRoomKey(roomId));
    await this.redis.srem(this.getActivePartiesKey(), roomId);
  }

  async getActiveParties(): Promise<PartyState[]> {
    const ids = await this.redis.smembers(this.getActivePartiesKey());
    const states = await Promise.all(ids.map(id => this.getPartyState(id)));
    return states.filter(s => s !== null) as PartyState[];
  }
}
