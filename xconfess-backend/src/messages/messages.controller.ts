import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * GET /messages/:userId/inbox
   * Users can only read their own inbox.
   */
  @Get(':userId/inbox')
  @UseGuards(OwnershipGuard)
  @Ownership({ paramKey: 'userId' })
  async getInbox(@Param('userId') userId: string, @Req() req: any) {
    return this.messagesService.getInbox(req.user.sub);
  }

  /**
   * GET /messages/thread/:threadId
   * Verify the requester is a participant in the thread — not just authenticated.
   */
  @Get('thread/:threadId')
  async getThread(@Param('threadId') threadId: string, @Req() req: any) {
    const thread = await this.messagesService.getThreadWithParticipantCheck(
      threadId,
      req.user.sub,
    );
    return thread;
  }

  /**
   * DELETE /messages/:userId/thread/:threadId
   * Only the owner can delete from their view.
   */
  @Delete(':userId/thread/:threadId')
  @UseGuards(OwnershipGuard)
  @Ownership({ paramKey: 'userId' })
  async deleteThread(
    @Param('userId') userId: string,
    @Param('threadId') threadId: string,
    @Req() req: any,
  ) {
    return this.messagesService.deleteForUser(req.user.sub, threadId);
  }
}