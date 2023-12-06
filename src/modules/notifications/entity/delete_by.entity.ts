import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';

export type DeletedByDocument = HydratedDocument<DeletedBy>;

@Schema()
export class DeletedBy {
	@Prop({
		require: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	user!: User;

	@Prop({
		required: true,
		type: Date,
		default: Date.now,
	})
	@Type(() => Date)
	deleted_at!: Date;
}

export const DeletedBySchema = SchemaFactory.createForClass(DeletedBy);
