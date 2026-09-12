import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CurrentUser } from './current-user.decorator';
import { SessionUserDto } from './dto/session-user.dto';
import { SessionUser } from './session-user.type';

@ApiTags('auth')
@ApiCookieAuth('session')
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({
    summary: 'The signed-in user',
    description:
      'Answers from the session the guard already resolved, so it costs no extra query beyond the one that authorised the request.',
  })
  @ApiOkResponse({ description: 'The caller.', type: SessionUserDto })
  @ApiUnauthorizedResponse({
    description: 'No valid session on the request.',
    type: ErrorResponseDto,
  })
  getMe(@CurrentUser() user: SessionUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('No user found in request');
    }
    return user;
  }
}
