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
import { Class, ClassDocument } from '@modules/classes/entities/class.entity';

@Injectable()
export class NotificationsService extends BaseServiceAbstract<NotificationEntity> {
	private readonly logger = new Logger(NotificationsService.name);
	constructor(
		@Inject('NotificationsRepositoryInterface')
		private readonly notif_repository: NotificationsRepositoryInterface,
		@InjectModel(NotificationEntity.name)
		private readonly notif_model: PaginateModel<NotificationDocument>,
		@InjectModel(Class.name)
		private readonly class_model: PaginateModel<ClassDocument>,
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
				ignoreExpiration: false,
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

			socket.disconnect(true);
		}
	}

	@OnEvent('notification.create')
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
		const joinedClass = await this.class_model.find(
			{
				$or: [
					{
						teachers: [user_id],
					},
					{
						students: [user_id],
					},
					{
						owner: user_id,
					},
				],
			},
			{
				_id: 1,
			},
		);
		return await this.notif_model.paginate(
			{
				$or: [
					{ receivers: user_id },
					{
						class: {
							$in: joinedClass.map((class_) => class_._id),
						},
						receivers: user_id,
					},
				],
				'deleted_by.user': {
					$ne: user_id,
				},
				sender: {
					$ne: user_id,
				},
			},
			options,
		);
	}

	async countUnread(user_id: string) {
		return await this.notif_model.countDocuments({
			receivers: user_id,
			'read_by.user': {
				$nin: [user_id],
			},
			'deleted_by.user': {
				$nin: [user_id],
			},
		});
	}

	async markRead(user_id: string, notif_id: string) {
		const notification = await this.notif_model.findOne({
			_id: notif_id,
			receivers: user_id,
			'deleted_by.user': {
				$nin: [user_id],
			},
		});

		if (!notification) {
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
				'read_by.user': {
					$nin: [user_id],
				},
				'deleted_by.user': {
					$nin: [user_id],
				},
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

	async markRemove(user_id: string, notif_id: string) {
		const notification = await this.notif_model.findOne({
			_id: notif_id,
			receivers: user_id,
			'deleted_by.user': {
				$nin: [user_id],
			},
		});

		if (!notification) {
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

	@OnEvent('class.students.left')
	async markRemoveAllInClass(user_id: string[] | string, class_id: string) {
		if (Array.isArray(user_id)) {
			const updateQuery = user_id.map((id) => ({
				user: id,
			}));
			return await this.notif_model.updateMany(
				{
					class: class_id,
					receivers: {
						$in: user_id,
					},
					'deleted_by.user': {
						$nin: [...user_id],
					},
				},
				{
					$addToSet: {
						deleted_by: updateQuery,
					},
				},
				{
					multi: true,
					new: true,
				},
			);
		}
		return await this.notif_model.updateMany(
			{
				receivers: user_id,
				class: class_id,
				'deleted_by.user': {
					$nin: [user_id],
				},
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
