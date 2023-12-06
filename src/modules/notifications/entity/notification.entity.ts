import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';
import * as mongoosePaginate from 'mongoose-paginate-v2';
import { ReadBy, ReadBySchema } from './read_by.entity';
import { Class } from '@modules/classes/entities/class.entity';
import { DeletedBy, DeletedBySchema } from './delete_by.entity';

export type NotificationDocument = HydratedDocument<Notification>;

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
	message?: string;

	@Prop({
		required: false,
		type: String,
	})
	ref_url?: string;

	@Prop({
		required: false,
		default: [],
		type: [
			{
				type: ReadBySchema,
			},
		],
	})
	@Type(() => ReadBy)
	read_by?: ReadBy[];

	@Prop({
		required: false,
		default: [],
		type: [
			{
				type: DeletedBySchema,
			},
		],
	})
	@Type(() => DeletedBy)
	deleted_by?: DeletedBy[];

	@Prop({
		required: false,
		type: mongoose.Schema.Types.ObjectId,
		ref: Class.name,
	})
	@Type(() => Class)
	class?: Class;

	@Prop({
		required: false,
		default: [],
		type: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: User.name,
			},
		],
	})
	@Type(() => User)
	receivers?: User[];

	@Prop({
		require: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	sender!: User;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

export const NotificationSchemaFactory = () => {
	const notification_schema = NotificationSchema;
	notification_schema.plugin(mongoosePaginate);
	return notification_schema;
};
