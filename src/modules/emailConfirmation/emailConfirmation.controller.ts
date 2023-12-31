import {
	Req,
	Controller,
	UseInterceptors,
	Post,
	Body,
	UseGuards,
} from '@nestjs/common';
import { EmailConfirmationService } from './emailConfirmation.service';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { User } from '@modules/users/entities/user.entity';
import ConfirmEmailDto from './dto/confirmEmail.dto';
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '@modules/auth/guards/jwt-access-token.guard';
import { RequestWithUser } from 'src/types/requests.type';

@Controller('email-confirmation')
@ApiTags('email-confirmation')
@ApiBearerAuth()
@UseInterceptors(MongooseClassSerializerInterceptor(User))
export class EmailConfirmationController {
	constructor(
		private readonly emailConfirmationService: EmailConfirmationService,
	) {}

	@ApiBadRequestResponse({
		description: 'Validation failed',
		content: {
			'application/json': {
				examples: {
					'Email already confirmed': {
						value: {
							statusCode: 400,
							message: 'Email already confirmed',
							error: 'Bad Request',
						},
					},
					'Email confirmation token expired': {
						value: {
							statusCode: 400,
							message: 'Email confirmation token expired',
							error: 'Bad Request',
						},
					},
					'Bad confirmation token': {
						value: {
							statusCode: 400,
							message: 'Bad confirmation token',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
	@Post('confirm')
	async confirm(@Body() confirmationData: ConfirmEmailDto) {
		const email = await this.emailConfirmationService.decodeConfirmationToken(
			confirmationData.token,
		);
		await this.emailConfirmationService.confirmEmail(email);
	}

	@ApiBadRequestResponse({
		description: 'Email already confirmed',
		content: {
			'application/json': {
				examples: {
					'Email already confirmed': {
						value: {
							statusCode: 400,
							message: 'Email already confirmed',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
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
	@UseGuards(JwtAccessTokenGuard)
	@Post('resend')
	async resendConfirmationLink(@Req() request: RequestWithUser) {
		await this.emailConfirmationService.resendConfirmationLink(request.user.id);
	}
}
