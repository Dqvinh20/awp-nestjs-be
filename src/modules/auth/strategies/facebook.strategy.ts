import { PROVIDER_TYPE } from '@modules/authentication_providers/entity/authentication_provider.entity';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor() {
		super({
			clientID: process.env.FACEBOOK_AUTH_CLIENT_ID,
			clientSecret: process.env.FACEBOOK_AUTH_CLIENT_SECRET,
			callbackURL: `${
				process.env.NODE_ENV
					? 'http://localhost:3000'
					: 'https://awp-project.hausuper-s.me'
			}/api/auth/facebook-redirect`,
			scope: 'email',
			profileFields: ['id', 'name', 'displayName', 'photos', 'email'],
		});
	}

	authenticate(req: any, options: any) {
		if (!options?.state) {
			options = { ...options, state: req.params.from };
		}

		return super.authenticate(req, options);
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
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
