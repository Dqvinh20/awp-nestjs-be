import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';

export type ReviewCommentDocument = HydratedDocument<ReviewComment>;

@Schema({
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
})
export class ReviewComment {
	@Prop({ required: true, minlength: 0, maxlength: 500 })
	comment: string;

	@Prop({
		required: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	sender: User;
}

export const ReviewCommentSchema = SchemaFactory.createForClass(ReviewComment);
