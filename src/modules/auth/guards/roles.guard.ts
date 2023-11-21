import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	Logger,
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
		const logger = new Logger(RolesGuard.name);

		const roles: string[] = this.reflector.getAllAndOverride(ROLES, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!roles) {
			return true;
		} else if (roles.length === 0) {
			return true;
		}

		const request: RequestWithUser = context.switchToHttp().getRequest();
		logger.debug(`Required role: ${roles}`);
		logger.debug(`User '${request.user.email}' role: ${request.user.role}`);
		const isAuthorized = roles.includes(request.user.role as unknown as string);
		if (!isAuthorized)
			throw new ForbiddenException("User doesn't have permission to access");

		return isAuthorized;
	}
}
