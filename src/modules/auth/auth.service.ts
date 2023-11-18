import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import {
	BadRequestException,
	ConflictException,
	Injectable,
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

@Injectable()
export class AuthService {
	constructor(
		private config_service: ConfigService,
		private readonly users_service: UsersService,
		private readonly jwt_service: JwtService,
	) {}

	async signUp(sign_up_dto: SignUpDto) {
		try {
			const existed_user = await this.users_service.findOneByCondition({
				email: sign_up_dto.email,
			});
			if (existed_user) {
				throw new ConflictException('Email already existed!!');
			}
			const hashed_password = hashPassword(sign_up_dto.password);
			const user = await this.users_service.create({
				...sign_up_dto,
				password: hashed_password,
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
}
