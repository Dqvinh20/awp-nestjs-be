import { PROVIDER_TYPE } from './../../authentication_providers/entity/authentication_provider.entity';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import base64url from 'base64url';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor() {
		super({
			clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
			clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
			callbackURL: `${
				process.env.NODE_ENV === 'development'
					? 'http://localhost:3000'
					: 'https://awp-project.hausuper-s.me'
			}/api/auth/google-redirect`,
			scope: ['email', 'profile'],
		});
	}

	authenticate(req: any, options: any) {
		if (!options?.state) {
			options = {
				...options,
				state: base64url(
					JSON.stringify({
						from: req.params.from,
						return_url: req.query.return_url,
					}),
				),
			};
		}

		return super.authenticate(req, options);
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: any,
	): Promise<any> {
		const { name, emails, photos } = profile;
		const user = {
			provider_user_id: profile.id,
			provider_type: profile.provider as PROVIDER_TYPE,
			email: emails[0].value,
			firstName: name.givenName,
			lastName: name.familyName,
			picture: photos[0].value,
			access_token: accessToken,
			refresh_token: refreshToken,
		};
		return user;
	}
}
