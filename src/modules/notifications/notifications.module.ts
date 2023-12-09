import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '@modules/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsRepository } from '@repositories/notifications.repository';
import { MongooseModule } from '@nestjs/mongoose';
import {
	Notification,
	NotificationSchemaFactory,
} from './entity/notification.entity';
import { NotificationsController } from './notifications.controller';
import {
	Class,
	ClassSchemaFactory,
} from '@modules/classes/entities/class.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
	imports: [
		MongooseModule.forFeatureAsync([
			{
				name: Notification.name,
				useFactory: NotificationSchemaFactory,
			},
		]),
		MongooseModule.forFeatureAsync([
			{
				name: Class.name,
				imports: [ConfigModule],
				inject: [ConfigService],
				useFactory: ClassSchemaFactory,
			},
		]),
		JwtModule,
	],
	controllers: [NotificationsController],
	providers: [
		NotificationsService,
		NotificationsGateway,
		{
			provide: 'NotificationsRepositoryInterface',
			useClass: NotificationsRepository,
		},
	],
})
export class NotificationsModule {}
