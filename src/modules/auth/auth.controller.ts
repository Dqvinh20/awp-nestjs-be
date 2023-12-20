import { PROVIDER_TYPE } from './../authentication_providers/entity/authentication_provider.entity';
import { ConfigService } from '@nestjs/config';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	Logger,
	NotFoundException,
	Post,
	Query,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { RequestWithUser } from 'src/types/requests.type';
import { JwtRefreshTokenGuard } from './guards/jwt-refresh-token.guard';
import { SignUpDto } from './dto/sign-up.dto';
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { EmailConfirmationService } from '@modules/emailConfirmation/emailConfirmation.service';
import { JwtAccessTokenGuard } from './guards/jwt-access-token.guard';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { Request, Response } from 'express';
import { FacebookOauthGuard } from './guards/facebook-oauth.guard';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { FinishSignUpDto } from './dto/finish-sign-up.dto';
import { User } from '@modules/users/entities/user.entity';
import { UserRolesService } from '@modules/user-roles/user-roles.service';

@Controller('auth')
@ApiTags('auth')
@ApiBearerAuth()
export class AuthController {
	private readonly logger = new Logger(AuthController.name);
	constructor(
		private readonly auth_service: AuthService,
		private readonly user_roles_service: UserRolesService,
		private readonly emailConfirmationService: EmailConfirmationService,
		private readonly configService: ConfigService,
	) {}

	@ApiOperation({
		summary: 'User sign up to platform',
		description: '## User sign up',
	})
	@ApiBody({
		type: SignUpDto,
		examples: {
			student: {
				value: {
					email: 'johndoe@example.com',
					password: '1232@asdS',
					student_id: '20176082',
					role: USER_ROLE.STUDENT,
				} as SignUpDto,
			},
			teacher: {
				value: {
					email: 'teacher@example.com',
					password: 'Teacher@1234',
					role: USER_ROLE.TEACHER,
				} as SignUpDto,
			},
		},
	})
	@ApiCreatedResponse({
		description: 'User created successfully!!',
		content: {
			'application/json': {
				examples: {
					created_user: {
						summary: 'Response after sign up',
						value: {
							access_token:
								'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjQ0MWNkNmJlMWQ0ZTBiNDRjNzA3NDk2IiwiaWF0IjoxNjgyMDM0MDI3LCJleHAiOjE2ODIwMzc2Mjd9.AH4z7uDWuEDjOs8sesB0ItxKUJ2M3rjul1D1mmjAKieOZblej5mp0JQE5IdgB9LlAOzOtKOLL5RWhxLCZ-YskvoRA7Yqza_rOjfIHeNseC3M66kKYqORN07aZDiA2OWhT3pXBqoKRCUBQCKLgMCAPT-CHryc0wUQGaKxP8YJO8dwIhGtjADchmzNJVBs4G7qYnpZAsORayd5GNfgoLpWmVFIBHSnPLNIL4dL8dLof0GBmVhdjhnHIUXYQlqL1wiwsmxmUC9TU2uiChm-TAhuiQyVwFokSySBJzBrLmEtgy89aaR0YizFK-QMg2xW3cJiiRzEBigTdsR0kvdUlk5GOg',
							refresh_token:
								'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjQ0MWNkNmJlMWQ0ZTBiNDRjNzA3NDk2IiwiaWF0IjoxNjgyMDM0MDI3LCJleHAiOjE2ODIwNTkyMjd9.aKNZymKdf3VEbPkda2cYYTS7KlpCbTqdXP30LREQ2b_fJ8q8cA0OyNEARK3Jm5yGsKoNd3txi54XmEbf19LC9CuDf9kwgLasPizEeMZsAJqSbSguzE4-9b4sSdf22GyipCcZJpkXkp01Bew04J8Y4FqhNARONsWzySXg8_VVWOGkfHGJVHFs7xYyVvmt3RErJwRM5s1Ou1ok7VW62FSTSAvXw6-qsHp5T7kXo73jECBqSuNEs5JcdluoBjdaAxggHYaDgTXoRh7y4Mn_fVKCQarAsUAxg6w0fxc8Gj0nP1ct3-GjG-Of-0O-iF7uynI2Lnq_On7WUsH7rFSysNyHUg',
						},
					},
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Validation failed',
		content: {
			'application/json': {
				examples: {
					invalid_email_password: {
						value: {
							statusCode: 400,
							message: [
								'email must be an email',
								'password is not strong enough',
							],
							error: 'Bad Request',
						},
					},
					student_id_required_for_student: {
						value: {
							statusCode: 400,
							message: 'Student ID is required!!',
							error: 'Bad Request',
						},
					},
					student_id_not_required_for_teacher: {
						value: {
							statusCode: 400,
							message: 'Student ID is not required for teacher!!',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
	@ApiConflictResponse({
		description: 'Conflict user info',
		content: {
			'application/json': {
				examples: {
					email_duplication: {
						value: {
							statusCode: 409,
							message: 'Email already existed!!',
							error: 'Conflict',
						},
					},
				},
			},
		},
	})
	@Post('sign-up')
	async signUp(@Body() sign_up_dto: SignUpDto, @Req() request) {
		const user = await this.auth_service.signUp(sign_up_dto);
		await this.emailConfirmationService.sendVerificationLink(sign_up_dto.email);

		// Set refresh token to cookie
		const refreshTokenCookie = this.auth_service.getCookieRefreshToken(
			user.refresh_token,
		);
		request.res.setHeader('Set-Cookie', refreshTokenCookie);
		return user;
	}

	@UseGuards(LocalAuthGuard)
	@Post('sign-in')
	@ApiBody({
		type: SignUpDto,
		examples: {
			user_1: {
				value: {
					email: 'admin@example.com',
					password: 'Admin@123',
				} as SignUpDto,
			},
			user_2: {
				value: {
					email: 'michaelsmith@example.com',
					password: '1232@asdS',
				} as SignUpDto,
			},
		},
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized',
		content: {
			'application/json': {
				example: {
					statusCode: 400,
					message: 'Wrong credentials!!',
					error: 'Bad Request',
				},
			},
		},
	})
	async signIn(
		@Req() request: RequestWithUser,
		@Query('isAdmin') isAdmin = false,
	) {
		const { user } = request;
		if (isAdmin) {
			const role = await this.user_roles_service.findOne(user.role.toString());
			if ((role.name as unknown as USER_ROLE) !== USER_ROLE.ADMIN) {
				throw new UnauthorizedException('You are not admin!!');
			}
		}

		const data = await this.auth_service.signIn(user._id.toString());

		// Set refresh token to cookie
		const refreshTokenCookie = this.auth_service.getCookieRefreshToken(
			data.refresh_token,
		);
		request.res.setHeader('Set-Cookie', refreshTokenCookie);

		this.logger.debug('User - ' + request.user.email + ' sign in');

		return data;
	}

	async socialLogin(
		req: Request,
		res: Response,
		provider_type = PROVIDER_TYPE.GOOGLE,
	) {
		const successRedirectUrl = (auth) =>
			`${this.configService.get<string>(
				'BASE_FE_URL',
			)}/${provider_type}-oauth-success-redirect/${auth.access_token}${
				req.params.from
			}?return_url=${req.query.return_url}`;

		try {
			const auth = (await this.auth_service.socialLogin(req.user)) as any;

			// Set refresh token to cookie
			const refreshTokenCookie = this.auth_service.getCookieRefreshToken(
				auth.refresh_token,
			);
			res.setHeader('Set-Cookie', refreshTokenCookie);

			return res.redirect(successRedirectUrl(auth));
		} catch (error) {
			try {
				if (error instanceof NotFoundException) {
					if (error.message === 'User are not registered yet!!') {
						const auth = (await this.auth_service.socialSignUp(
							req.user,
						)) as any;

						// Set refresh token to cookie
						const refreshTokenCookie = this.auth_service.getCookieRefreshToken(
							auth.refresh_token,
						);
						res.setHeader('Set-Cookie', refreshTokenCookie);

						return res.redirect(successRedirectUrl(auth));
					}
				}
			} catch (error1) {
				return res.redirect(
					`${this.configService.get<string>('BASE_FE_URL')}/sign-in?error=${
						error1.message
					}`,
				);
			}
		}
	}

	@Get('facebook/:from')
	@UseGuards(FacebookOauthGuard)
	async facebookLogin() {
		/* Empty */
	}

	@Get('facebook-redirect')
	@UseGuards(FacebookOauthGuard)
	async facebookLoginRedirect(
		@Req() req: Request,
		@Res() res: Response,
	): Promise<any> {
		this.logger.debug(
			'User - ' + (req.user as any).email + ' sign in with facebook',
		);
		return this.socialLogin(req, res, PROVIDER_TYPE.FACEBOOK);
	}

	@Get('google/:from')
	@UseGuards(GoogleOauthGuard)
	async googleAuth() {
		/* Empty */
	}

	@Get('google-redirect')
	@UseGuards(GoogleOauthGuard)
	async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
		this.logger.debug(
			'User - ' + (req.user as any).email + ' sign in with google',
		);
		return this.socialLogin(req, res, PROVIDER_TYPE.GOOGLE);
	}

	@Post('finish-sign-up')
	@UseGuards(JwtAccessTokenGuard)
	async finishSignUp(@AuthUser() user: User, @Body() body: FinishSignUpDto) {
		if (user.role) {
			throw new BadRequestException('Already finished sign up!!. Not allowed');
		}

		return await this.auth_service.finishSignUp(user.id, body);
	}

	@UseGuards(JwtRefreshTokenGuard)
	@Post('refresh')
	async refreshAccessToken(@Req() request: RequestWithUser) {
		const { user } = request;
		const access_token = this.auth_service.generateAccessToken({
			user_id: user._id.toString(),
		});
		return {
			access_token,
		};
	}

	@UseGuards(JwtAccessTokenGuard)
	@Post('log-out')
	@HttpCode(200)
	async logOut(@Req() request: RequestWithUser) {
		this.logger.debug('User - ' + request.user.email + ' log out');
		await this.auth_service.removeRefreshToken(request.user.id);
		request.res.setHeader(
			'Set-Cookie',
			this.auth_service.getCookiesForLogOut(),
		);
	}
}
