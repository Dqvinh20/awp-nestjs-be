import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';
import * as mongoosePaginate from 'mongoose-paginate-v2';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NOTIFICATION_STATUS {
	READ = 'READ',
	UNREAD = 'UNREAD',
	REMOVE = 'REMOVE',
}

export enum NOTIFICATION_TYPE {
	INFO = 'INFO',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	SUCCESS = 'SUCCESS',
}

@Schema({
	collection: 'notifications',
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
	toJSON: {
		getters: true,
		virtuals: true,
	},
})
export class Notification extends BaseEntity {
	@Prop({
		required: true,
		type: String,
		maxlength: 100,
	})
	title!: string;

	@Prop({
		required: false,
		type: String,
		maxlength: 255,
	})
	description!: string;

	@Prop({
		required: false,
		type: String,
	})
	icon?: string;

	@Prop({
		required: false,
		type: String,
	})
	link?: string;

	@Prop({
		required: false,
		default: NOTIFICATION_STATUS.UNREAD,
		enum: NOTIFICATION_STATUS,
	})
	status: NOTIFICATION_STATUS;

	@Prop({
		required: false,
		default: NOTIFICATION_TYPE.INFO,
		enum: NOTIFICATION_TYPE,
	})
	type: NOTIFICATION_TYPE;

	@Prop({
		required: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	to!: User;

	@Prop({
		require: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	created_by!: User;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

export const NotificationSchemaFactory = () => {
	const notification_schema = NotificationSchema;
	notification_schema.plugin(mongoosePaginate);
	return notification_schema;
};
