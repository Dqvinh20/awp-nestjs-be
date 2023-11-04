import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { isArray } from 'class-validator';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class SwaggerArrayConversion implements NestInterceptor {
	constructor(private readonly property_name: string) {}
	intercept(
		context: ExecutionContext,
		next: CallHandler<any>,
	): Observable<any> | Promise<Observable<any>> {
		const request: Request = context.switchToHttp().getRequest();
		if (
			request.headers.referer.match(/api-docs/g) &&
			request.body[this.property_name]
		) {
			if (
				isArray(request.body[this.property_name]) &&
				request.body[this.property_name].length === 1
			) {
				request.body[this.property_name] =
					request.body[this.property_name][0].split(',');
			}
		}
		return next.handle();
	}
}
