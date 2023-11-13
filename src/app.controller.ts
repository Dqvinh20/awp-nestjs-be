import {
	Controller,
	Get,
	Req,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { UsersService } from '@modules/users/users.service';
import { JwtAccessTokenGuard } from '@modules/auth/guards/jwt-access-token.guard';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import MongooseClassSerializerInterceptor from './interceptors/mongoose-class-serializer.interceptor';
import { User } from '@modules/users/entities/user.entity';

@Controller()
@ApiUnauthorizedResponse({
	description: 'Unauthorized',
	schema: {
		type: 'object',
		example: {
			statusCode: 401,
			message: 'Unauthorized',
		},
	},
})
@UseInterceptors(MongooseClassSerializerInterceptor(User))
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly usersService: UsersService,
	) {}

	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Get current logged user infor',
		description: ``,
	})
	@ApiOkResponse({
		description: 'Return current logged user infor',
	})
	@UseGuards(JwtAccessTokenGuard)
	@Get('/me')
	async getCurrentUserInfo(@Req() request) {
		const { user } = request;
		return user;
	}
}
