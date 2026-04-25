import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body.username, body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.userService.findOneByUsername(body.username);
    if (user && (await bcrypt.compare(body.password, user.password))) {
      return this.authService.login(user);
    }
    throw new UnauthorizedException('Invalid credentials');
  }
}
