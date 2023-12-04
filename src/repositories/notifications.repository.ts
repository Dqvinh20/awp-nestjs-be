import { NotificationsRepositoryInterface } from '@modules/notifications/interfaces/notifications.interface';
import { NotificationDocument } from './../modules/notifications/entity/notification.entity';
import { InjectModel } from '@nestjs/mongoose';
import { PaginateModel } from 'mongoose';
import { BasePaginateRepositoryAbstract } from './base/base_paginate.abstract.repository';
import { Notification as NotificationEntity } from './../modules/notifications/entity/notification.entity';
export class NotificationsRepository
	extends BasePaginateRepositoryAbstract<NotificationDocument>
	implements NotificationsRepositoryInterface
{
	constructor(
		@InjectModel(NotificationEntity.name)
		private readonly notification_model: PaginateModel<NotificationDocument>,
	) {
		super(notification_model);
	}
}
