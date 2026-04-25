import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(username: string, email: string, pass: string) {
    const existing = await this.userService.findOneByUsernameOrEmail(username, email);
    if (existing) {
      throw new ConflictException('User already exists');
    }
    const hashedPassword = await bcrypt.hash(pass, 10);
    const user = await this.userService.create({
      username,
      email,
      password: hashedPassword,
      channelName: username,
      fullName: username,
    });
    return this.login(user);
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        channelName: user.channelName,
        fullName: user.fullName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      }
    };
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findOneByUsername(username);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException();
  }
}
