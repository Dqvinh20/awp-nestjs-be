import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload } from './interfaces/token.interface';
import { ConfigService } from '@nestjs/config';
import {
	scryptHash,
	scryptCompare,
} from '@modules/shared/helper/scrypt.helper';
import {
	access_token_private_key,
	refresh_token_private_key,
} from 'src/constraints/jwt.constraint';
import { SignUpDto } from './dto/sign-up.dto';
import {
	comparePassword,
	hashPassword,
} from '@modules/shared/helper/password.helper';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { AuthenticationProvidersService } from '@modules/authentication_providers/authentication_providers.service';
import { AuthenticationProviderDocument } from '@modules/authentication_providers/entity/authentication_provider.entity';
import { FinishSignUpDto } from './dto/finish-sign-up.dto';
import { UserRolesService } from '@modules/user-roles/user-roles.service';

@Injectable()
export class AuthService {
	constructor(
		private config_service: ConfigService,
		private readonly users_service: UsersService,
		private readonly user_roles_service: UserRolesService,
		private readonly jwt_service: JwtService,
		private readonly authen_provider_service: AuthenticationProvidersService,
	) {}

	async signUp(sign_up_dto: SignUpDto) {
		try {
			const existed_user = await this.users_service.getUserByEmail(
				sign_up_dto.email,
			);
			if (existed_user) {
				throw new ConflictException('Email already existed!!');
			}

			const hashed_password = hashPassword(sign_up_dto.password);

			const user = await this.users_service.create({
				...sign_up_dto,
				password: hashed_password,
			});

			await this.users_service.update(user.id, {
				role: null,
			});

			const refresh_token = this.generateRefreshToken({
				user_id: user._id.toString(),
			});
			await this.storeRefreshToken(user._id.toString(), refresh_token);
			return {
				access_token: this.generateAccessToken({
					user_id: user._id.toString(),
				}),
				refresh_token,
			};
		} catch (error) {
			throw error;
		}
	}

	async signIn(user_id: string) {
		try {
			const access_token = this.generateAccessToken({
				user_id,
			});
			const refresh_token = this.generateRefreshToken({
				user_id,
			});
			await this.storeRefreshToken(user_id, refresh_token);
			return {
				access_token,
				refresh_token,
			};
		} catch (error) {
			throw error;
		}
	}

	async getAuthenticatedUser(email: string, password: string): Promise<User> {
		try {
			const user = await this.users_service.getUserByEmail(email);
			await this.verifyPlainContentWithHashedContent(password, user.password);
			return user;
		} catch (error) {
			throw new BadRequestException('Wrong credentials!!');
		}
	}

	private async verifyPlainContentWithHashedContent(
		plain_text: string,
		hashed_text: string,
	) {
		const is_matching = comparePassword(plain_text, hashed_text);
		if (!is_matching) {
			throw new BadRequestException();
		}
	}

	async getUserIfRefreshTokenMatched(
		user_id: string,
		refresh_token: string,
	): Promise<User> {
		try {
			const user = await this.users_service.findOneByCondition({
				_id: user_id,
			});
			if (!user) {
				throw new UnauthorizedException();
			}

			const is_matching = await scryptCompare(
				refresh_token,
				user.current_refresh_token,
			);

			if (!is_matching) {
				throw new BadRequestException();
			}

			return user;
		} catch (error) {
			throw error;
		}
	}

	generateAccessToken(payload: TokenPayload) {
		return this.jwt_service.sign(payload, {
			algorithm: 'RS256',
			privateKey: access_token_private_key,
			expiresIn: `${this.config_service.get<string>(
				'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
			)}s`,
		});
	}

	generateRefreshToken(payload: TokenPayload) {
		return this.jwt_service.sign(payload, {
			algorithm: 'RS256',
			privateKey: refresh_token_private_key,
			expiresIn: `${this.config_service.get<string>(
				'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
			)}s`,
		});
	}

	getCookieRefreshToken(token: string) {
		const cookie = `Refresh=${token}; HttpOnly; Path=/; Max-Age=${this.config_service.get(
			'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
		)}`;
		return cookie;
	}

	async storeRefreshToken(user_id: string, token: string): Promise<void> {
		try {
			const hashed_token = await scryptHash(token);
			await this.users_service.setCurrentRefreshToken(user_id, hashed_token);
		} catch (error) {
			throw error;
		}
	}

	async removeRefreshToken(user_id: string) {
		return this.users_service.setCurrentRefreshToken(user_id, null);
	}

	getCookiesForLogOut() {
		return ['Refresh=; HttpOnly; Path=/; Max-Age=0'];
	}

	async socialLogin(user) {
		if (!user) {
			throw new NotFoundException('Social login failed!!');
		}

		await this.authen_provider_service
			.findOneByCondition({
				provider_user_id: user.provider_user_id,
				provider_type: user.provider_type,
			})
			.then((entity: AuthenticationProviderDocument) => {
				if (!entity) {
					throw new NotFoundException('User are not registered yet!!');
				}
				return entity.populate('user');
			});

		const dbUser = await this.users_service.findOneByCondition({
			email: user.email,
		});

		if (!dbUser) {
			throw new NotFoundException('User are not registered yet!!');
		}

		return this.signIn(dbUser._id.toString());
	}

	async socialSignUp(user) {
		let savedUser;
		let savedAuthenProvider;
		try {
			const existed_user = await this.users_service.findOneByCondition({
				email: user.email,
			});
			if (existed_user) {
				return this.signIn(existed_user._id.toString());
			}

			savedUser = await this.users_service.create({
				email: user.email,
				first_name: user.firstName,
				last_name: user.lastName,
				avatar: user.picture,
				isEmailConfirmed: true,
			} as any);

			await this.users_service.update(savedUser.id, {
				role: null,
			});

			savedAuthenProvider = await this.authen_provider_service.create({
				provider_user_id: user.provider_user_id,
				provider_type: user.provider_type,
				user: savedUser.id,
			});

			const refresh_token = this.generateRefreshToken({
				user_id: savedUser._id.toString(),
			});

			await this.storeRefreshToken(savedUser._id.toString(), refresh_token);
			return {
				access_token: this.generateAccessToken({
					user_id: savedUser._id.toString(),
				}),
				refresh_token,
			};
		} catch (error) {
			if (savedUser) {
				await this.users_service.permanentlyDelete(user._id.toString());
			}
			if (savedAuthenProvider) {
				await this.authen_provider_service.permanentlyDelete(
					user._id.toString(),
				);
			}
			throw error;
		}
	}

	async finishSignUp(id: string, finishSignUpDto: FinishSignUpDto) {
		if (finishSignUpDto.role === USER_ROLE.STUDENT) {
			if (!finishSignUpDto.student_id) {
				throw new BadRequestException('Student ID is required!!');
			}
		}

		const user_role = await this.user_roles_service.findOneByCondition({
			name: finishSignUpDto.role,
		});

		if (!user_role) {
			throw new BadRequestException('Role is not valid');
		}

		const user = await this.users_service.update(id, {
			...finishSignUpDto,
			role: user_role,
		});

		return user;
	}
}
