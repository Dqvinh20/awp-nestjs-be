import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
	constructor(private configService: ConfigService) {
		super({
			// accessType: 'offline',
			// response_type: "code",
			// display: 'popup',
			// approvalPrompt: 'auto',
			prompt: 'select_account', //"consent"
		});
	}

	async canActivate(context: ExecutionContext) {
		try {
			const request = context.switchToHttp().getRequest() as Request;
			const from = (request.query.state as string)?.replace(/\@/g, '/');
			const activate = (await super.canActivate(context)) as boolean;
			request.params.from = from;
			return activate;
		} catch (ex) {
			throw ex;
		}
	}
}
