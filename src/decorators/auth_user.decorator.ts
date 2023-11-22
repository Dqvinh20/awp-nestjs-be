import { User } from '@modules/users/entities/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Get the authenticated user from the request
 * @returns {User} The authenticated user
 */
export const AuthUser = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): User => {
		const request = ctx.switchToHttp().getRequest();
		return request.user ?? null;
	},
);
