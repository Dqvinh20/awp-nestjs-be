import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

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
			jwtFromRequest: (req: Request) => {
				console.log(req.cookies);
				return '123';
			},
			ignoreExpiration: false,
			secretOrKey: refresh_token_public_key,
			passReqToCallback: true,
		});
	}

	async validate(request: Request, payload: TokenPayload) {
		return await this.auth_service.getUserIfRefreshTokenMatched(
			payload.user_id,
			request.headers.authorization.split('Bearer ')[1],
		);
	}
}
