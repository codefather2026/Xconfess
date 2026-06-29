import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ReactionService } from './reaction.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { Reaction } from './entities/reaction.entity';

@ApiTags('Reactions')
@Controller('reactions')
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Post()
  @ApiOperation({ summary: 'Add or update an emoji reaction on a confession' })
  @ApiBody({ type: CreateReactionDto })
  @ApiResponse({ status: 201, description: 'Reaction recorded.' })
  @ApiResponse({ status: 404, description: 'Confession or user not found.' })
  async addReaction(@Body() dto: CreateReactionDto): Promise<Reaction> {
    return this.reactionService.createReaction(dto);
  }
}
