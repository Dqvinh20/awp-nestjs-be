import { Notification } from '../entity/notification.entity';
import { BasePaginateRepositoryInterface } from '@repositories/base/base_paginate.interface.repository';

export type NotificationsRepositoryInterface =
	BasePaginateRepositoryInterface<Notification>;
