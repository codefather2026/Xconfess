import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** Public profile — no ownership required */
  @Get(':userId/profile')
  async getPublicProfile(@Param('userId') userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  /**
   * PATCH /users/:userId/settings
   * Ownership enforced independently at backend.
   */
  @Patch(':userId/settings')
  @UseGuards(OwnershipGuard)
  @Ownership({ paramKey: 'userId' })
  async updateSettings(
    @Param('userId') userId: string,
    @Body() dto: Record<string, unknown>,
    @Req() req: any,
  ) {
    return this.userService.updateSettings(req.user.sub, dto);
  }

  /**
   * DELETE /users/:userId
   * Only the account owner can delete it (admin handled separately).
   */
  @Delete(':userId')
  @UseGuards(OwnershipGuard)
  @Ownership({ paramKey: 'userId', adminBypass: true })
  async deleteAccount(@Param('userId') userId: string, @Req() req: any) {
    return this.userService.deleteAccount(req.user.sub);
  }
}