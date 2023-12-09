import { ApiTags } from '@nestjs/swagger';
import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
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
				path: 'sender',
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

	@Get('/unread/count')
	async countUnread(@AuthUser() user: User) {
		return await this.notificationsService.countUnread(user.id);
	}

	@Patch(':notif_id/read')
	async markRead(@Param('notif_id') notifId: string, @AuthUser() user: User) {
		return await this.notificationsService.markRead(user.id, notifId);
	}

	@Delete(':notif_id/remove')
	async markRemove(@Param('notif_id') notifId: string, @AuthUser() user: User) {
		return await this.notificationsService.markRemove(user.id, notifId);
	}
}
