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
import { MailerService } from '@nestjs-modules/mailer';

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
		private readonly mailerService: MailerService,
	) {}

	@Get('/test')
	async test() {
		this.mailerService
			.sendMail({
				to: 'duongquangvinh2210@gmail.com',
				subject: 'Testing Nest MailerModule ✔',
				template: 'enroll_invitation',
				context: {
					author: {
						avatar: 'https://via.placeholder.com/150',
						name: 'Mary',
						email: 'mary@example.com',
					},
					class: {
						name: 'Lop hoc i to',
					},
					enrollUrl: '#',
				},
			})
			.then(() => {
				console.log('success');
			})
			.catch(() => {
				console.log('error');
			});
		return 'test';
	}

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
