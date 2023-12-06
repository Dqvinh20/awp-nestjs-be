import {
	Inject,
	Injectable,
	BadRequestException,
	NotFoundException,
	Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { access_token_public_key } from 'src/constraints/jwt.constraint';
import { BaseServiceAbstract } from 'src/services/base/base.abstract.service';
import { NotificationsRepositoryInterface } from './interfaces/notifications.interface';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PaginateModel, PopulateOptions } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
	NotificationDocument,
	Notification as NotificationEntity,
} from './entity/notification.entity';
import { FindNotificationsDto } from './dto/find-all-paginate.dto';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService extends BaseServiceAbstract<NotificationEntity> {
	private readonly logger = new Logger(NotificationsService.name);
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

	@OnEvent('notification.create')
	create(data: CreateNotificationDto) {
		this.logger.debug('Create notification: ', JSON.stringify(data, null, 2));
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
			.find({
				receivers: user_id,
				deleted_by: {
					user: {
						$nin: [user_id],
					},
				},
			})
			.sort({ createdAt: -1 })
			.populate(populate);
	}

	async findAllByUserIdPaginate(
		user_id: string,
		options?: FindNotificationsDto,
	) {
		return await this.notif_model.paginate(
			{
				receivers: user_id,
				deleted_by: {
					user: {
						$nin: [user_id],
					},
				},
			},
			options,
		);
	}

	async markRead(notif_id: string, user_id: string) {
		const notification = await this.notif_model.findOne({
			_id: notif_id,
			receivers: user_id,
		});
		if (notification) {
			throw new NotFoundException('Notification not found or not yours');
		}

		const isRead = notification.read_by.find(
			(readBy) => readBy.user.toString() === user_id,
		);

		if (isRead) {
			throw new BadRequestException('Notification already read');
		}

		return await this.notif_model.findByIdAndUpdate(
			notif_id,
			{
				$addToSet: {
					read_by: {
						user: user_id,
					},
				},
			},
			{ new: true },
		);
	}

	async markReadAll(user_id: string) {
		return await this.notif_model.updateMany(
			{
				receivers: user_id,
			},
			{
				$addToSet: {
					read_by: {
						user: user_id,
					},
				},
			},
			{
				multi: true,
				new: true,
			},
		);
	}

	async markRemove(notif_id: string, user_id: string) {
		const notification = await this.notif_model.findOne({
			_id: notif_id,
			receivers: user_id,
		});
		if (notification) {
			throw new NotFoundException('Notification not found or not yours');
		}

		const isDeleted = notification.deleted_by.find(
			(deleted_by) => deleted_by.user.toString() === user_id,
		);

		if (isDeleted) {
			throw new BadRequestException('Notification already deleted');
		}

		return await this.notif_model.findByIdAndUpdate(
			notif_id,
			{
				$addToSet: {
					deleted_by: {
						user: user_id,
					},
				},
			},
			{ new: true },
		);
	}

	async markRemoveAll(user_id: string) {
		return await this.notif_model.updateMany(
			{
				receivers: user_id,
			},
			{
				$addToSet: {
					deleted_by: {
						user: user_id,
					},
				},
			},
			{
				multi: true,
				new: true,
			},
		);
	}
}
