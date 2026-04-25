import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WatchPartyService, PartyState } from './watch-party.service';
import { JwtService } from '@nestjs/jwt';
import { VideoService } from '../video/video.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WatchPartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track users in rooms for real-time presence
  private roomParticipants = new Map<string, Set<{ id: string, username: string }>>();

  constructor(
    private watchPartyService: WatchPartyService,
    private jwtService: JwtService,
    private videoService: VideoService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    try {
      const payload = this.jwtService.verify(token, { secret: 'super-secret-key' });
      client.data.user = {
        ...payload,
        id: payload.sub
      };
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    for (const [roomId, participants] of this.roomParticipants.entries()) {
      const userToRemove = Array.from(participants).find(p => p.id === client.data.user?.id);
      if (userToRemove) {
        participants.delete(userToRemove);
        if (participants.size === 0) {
          await this.watchPartyService.deletePartyState(roomId);
          this.roomParticipants.delete(roomId);
        } else {
          this.server.to(roomId).emit('participants-update', Array.from(participants));
        }
      }
    }
  }

  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomName: string; roomKey: string; videoId: string },
  ) {
    const roomId = `${client.data.user.id}-${data.roomKey}`;
    
    let videoTitle = '';
    if (data.videoId) {
      const video = await this.videoService.findOne(data.videoId).catch(() => null);
      videoTitle = video?.title || '';
    }

    const state = await this.watchPartyService.updatePartyState(roomId, {
      roomId,
      roomName: data.roomName,
      videoId: data.videoId,
      hostId: client.data.user.id,
      isPlaying: false,
      currentTime: 0,
      videoTitle, // Store title for discovery
    } as any);
    
    client.join(roomId);
    client.emit('room-created', state);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const state = await this.watchPartyService.getPartyState(roomId);

    if (!state) {
      client.emit('room-not-found', { roomId });
      return;
    }

    client.join(roomId);

    if (!this.roomParticipants.has(roomId)) {
      this.roomParticipants.set(roomId, new Set());
    }
    const participants = this.roomParticipants.get(roomId)!;
    const alreadyIn = Array.from(participants).some(p => p.id === client.data.user.id);
    if (!alreadyIn) {
      participants.add({ id: client.data.user.id, username: client.data.user.username });
      client.to(roomId).emit('user-joined', {
        userId: client.data.user.id,
        username: client.data.user.username,
      });
    }

    client.emit('sync-state', state);
    this.server.to(roomId).emit('participants-update', Array.from(participants));
  }

  @SubscribeMessage('delete-room')
  async handleDeleteRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const state = await this.watchPartyService.getPartyState(roomId);
    if (state && state.hostId === client.data.user.id) {
      await this.watchPartyService.deletePartyState(roomId);
      this.roomParticipants.delete(roomId);
      this.server.to(roomId).emit('room-deleted', { reason: 'Host ended the session' });
    }
  }

  @SubscribeMessage('send-message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; text: string },
  ) {
    this.server.to(data.roomId).emit('chat-message', {
      userId: client.data.user.id,
      username: client.data.user.username,
      text: data.text,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('request-video')
  handleVideoRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; video: any },
  ) {
    this.server.to(data.roomId).emit('video-requested', {
      username: client.data.user.username,
      video: data.video,
    });
  }

  @SubscribeMessage('change-video')
  async handleChangeVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; videoId: string },
  ) {
    const state = await this.watchPartyService.getPartyState(data.roomId);
    if (state && state.hostId === client.data.user.id) {
      const video = await this.videoService.findOne(data.videoId).catch(() => null);
      
      const newState = await this.watchPartyService.updatePartyState(data.roomId, {
        videoId: data.videoId,
        videoTitle: video?.title || '',
        currentTime: 0,
        isPlaying: false,
      } as any);
      this.server.to(data.roomId).emit('sync-state', newState);
    }
  }

  @SubscribeMessage('play')
  async handlePlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; currentTime: number },
  ) {
    const state = await this.watchPartyService.getPartyState(data.roomId);
    if (state && state.hostId === client.data.user.id) {
      const newState = await this.watchPartyService.updatePartyState(data.roomId, {
        isPlaying: true,
        currentTime: data.currentTime,
      });
      this.server.to(data.roomId).emit('sync-state', newState);
    }
  }

  @SubscribeMessage('pause')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; currentTime: number },
  ) {
    const state = await this.watchPartyService.getPartyState(data.roomId);
    if (state && state.hostId === client.data.user.id) {
      const newState = await this.watchPartyService.updatePartyState(data.roomId, {
        isPlaying: false,
        currentTime: data.currentTime,
      });
      this.server.to(data.roomId).emit('sync-state', newState);
    }
  }

  @SubscribeMessage('seek')
  async handleSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; currentTime: number },
  ) {
    const state = await this.watchPartyService.getPartyState(data.roomId);
    if (state && state.hostId === client.data.user.id) {
      const newState = await this.watchPartyService.updatePartyState(data.roomId, {
        currentTime: data.currentTime,
      });
      this.server.to(data.roomId).emit('sync-state', newState);
    }
  }

  @SubscribeMessage('get-active-parties')
  async handleGetActiveParties(@ConnectedSocket() client: Socket) {
    const parties = await this.watchPartyService.getActiveParties();
    client.emit('active-parties', parties);
  }
}
