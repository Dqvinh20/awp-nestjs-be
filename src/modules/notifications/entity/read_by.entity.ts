import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';

export type ReadByDocument = HydratedDocument<ReadBy>;

@Schema()
export class ReadBy {
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
	read_at!: Date;
}

export const ReadBySchema = SchemaFactory.createForClass(ReadBy);
