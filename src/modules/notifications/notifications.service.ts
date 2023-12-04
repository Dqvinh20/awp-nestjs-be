import { populate } from './../classes/classes.service';
import { BaseEntity } from '@modules/shared/base/base.entity';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { access_token_public_key } from 'src/constraints/jwt.constraint';
import { BaseServiceAbstract } from 'src/services/base/base.abstract.service';
import { NotificationsRepositoryInterface } from './interfaces/notifications.interface';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PaginateModel, PopulateOptions } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
	NOTIFICATION_STATUS,
	NotificationDocument,
	Notification as NotificationEntity,
} from './entity/notification.entity';
import { FindNotificationsDto } from './dto/find-all-paginate.dto';
@Injectable()
export class NotificationsService extends BaseServiceAbstract<NotificationEntity> {
	constructor(
		@Inject('NotificationsRepositoryInterface')
		private readonly notif_repository: NotificationsRepositoryInterface,
		@InjectModel(NotificationEntity.name)
		private readonly notif_model: PaginateModel<NotificationDocument>,
		private readonly jwt_service: JwtService,
	) {
		super(notif_repository);
	}

	async authenSocketUser(socket: Socket) {
		const token = socket.handshake.headers.authorization?.split(' ')[1];
		if (!token) {
			socket.disconnect(true);
			return;
		}

		try {
			const payload = await this.jwt_service.verify(token, {
				secret: access_token_public_key,
			});

			if (!payload) {
				socket.disconnect(true);
				return;
			}
		} catch (error) {
			if (error.name === 'TokenExpiredError') {
				socket.disconnect(true);
				return;
			}
		}
	}

	create(data: CreateNotificationDto) {
		return this.notif_repository.create(data);
	}

	createMany(data: CreateNotificationDto[]) {
		return this.notif_model.insertMany(data);
	}

	findAllByUserId(
		user_id: string,
		{ populate }: { populate?: PopulateOptions | PopulateOptions[] },
	) {
		return this.notif_model
			.find({ to: user_id, status: { $ne: NOTIFICATION_STATUS.REMOVE } })
			.sort({ createdAt: -1 })
			.populate(populate);
	}

	findAllByUserIdPaginate(user_id: string, options?: FindNotificationsDto) {
		return this.notif_model.paginate(
			{
				to: user_id,
				status: { $ne: NOTIFICATION_STATUS.REMOVE },
			},
			options,
		);
	}

	markRead(id: string) {
		return this.notif_model.findByIdAndUpdate(id, {
			status: NOTIFICATION_STATUS.READ,
		});
	}

	markReadAll(user_id: string) {
		return this.notif_model.updateMany(
			{ to: user_id },
			{ status: NOTIFICATION_STATUS.READ },
		);
	}

	markRemove(id: string) {
		return this.notif_model.findByIdAndUpdate(id, {
			status: NOTIFICATION_STATUS.REMOVE,
		});
	}

	permanentRemove(id: string) {
		return this.notif_model.findByIdAndDelete(id);
	}
}
