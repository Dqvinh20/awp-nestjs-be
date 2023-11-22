import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from 'src/types/requests.type';

/**
 * @description
 * Get the role of the user from the request object
 * @returns {USER_ROLE} role
 */
export const Role = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): USER_ROLE => {
		const request = ctx.switchToHttp().getRequest() as RequestWithUser;
		return (request?.user?.role as unknown as USER_ROLE) ?? null;
	},
);
