import { JwtAccessTokenGuard } from '@modules/auth/guards/jwt-access-token.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Roles } from './roles.decorator';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

/**
 * Custom decorator to apply JwtAccessTokenGuard and RolesGuard to a route or controller
 * @param roles Access roles
 * @returns void
 */
export function NeedAuth(...roles: USER_ROLE[]) {
	return applyDecorators(
		Roles(...roles),
		UseGuards(JwtAccessTokenGuard, RolesGuard),
		ApiBearerAuth(),
		ApiUnauthorizedResponse({
			description: 'Unauthorized',
			schema: {
				type: 'object',
				example: {
					statusCode: 401,
					message: 'Unauthorized',
				},
			},
		}),
	);
}
