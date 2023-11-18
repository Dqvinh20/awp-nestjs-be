import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES } from 'src/decorators/roles.decorator';
import { RequestWithUser } from 'src/types/requests.type';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(
		context: ExecutionContext,
	): boolean | Promise<boolean> | Observable<boolean> {
		const roles: string[] = this.reflector.getAllAndOverride(ROLES, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!roles) {
			return true;
		}

		const request: RequestWithUser = context.switchToHttp().getRequest();

		const isAuthorized = roles.includes(request.user.role as unknown as string);
		if (!isAuthorized)
			throw new ForbiddenException("User doesn't have permission");

		return isAuthorized;
	}
}
