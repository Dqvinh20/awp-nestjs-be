import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NeedAuth } from 'src/decorators/need_auth.decorator';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { User } from '@modules/users/entities/user.entity';
import { FindNotificationsDto } from './dto/find-all-paginate.dto';

@ApiTags('Notifications')
@Controller('notifications')
@NeedAuth()
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	@Get()
	async getNotifications(
		@AuthUser() user: User,
		@Query() body: FindNotificationsDto,
	) {
		return await this.notificationsService.findAllByUserIdPaginate(user.id, {
			...body,
			populate: {
				path: 'created_by',
				select: 'id first_name last_name avatar',
				transform(doc: User) {
					return {
						...doc,
						full_name: `${doc.first_name}${doc.first_name ? ' ' : ''}${
							doc.last_name
						}`,
					};
				},
			},
		});
	}
}
