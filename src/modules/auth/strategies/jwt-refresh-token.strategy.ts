import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from '../auth.service';
import { TokenPayload } from '../interfaces/token.interface';
import { refresh_token_public_key } from 'src/constraints/jwt.constraint';

@Injectable()
export class JwtRefreshTokenStrategy extends PassportStrategy(
	Strategy,
	'refresh_token',
) {
	constructor(private readonly auth_service: AuthService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => {
					return request?.cookies?.Refresh;
				},
			]),
			ignoreExpiration: false,
			secretOrKey: refresh_token_public_key,
			passReqToCallback: true,
		});
	}

	async validate(request: Request, payload: TokenPayload) {
		const refreshToken = request.cookies?.Refresh;
		const user = await this.auth_service.getUserIfRefreshTokenMatched(
			payload.user_id,
			refreshToken,
		);

		if (user.isActive === false) {
			throw new UnauthorizedException(
				'Your account is blocked!!. Contact admin for detail.',
			);
		}
		return user;
	}
}
