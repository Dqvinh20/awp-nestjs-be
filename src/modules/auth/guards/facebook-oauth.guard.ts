import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class FacebookOauthGuard extends AuthGuard('facebook') {
	constructor() {
		super();
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
