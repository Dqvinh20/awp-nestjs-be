import { Class } from '@modules/classes/entities/class.entity';
import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ReviewComment, ReviewCommentSchema } from './review_comment.entity';
import { Type } from 'class-transformer';
import mongoose from 'mongoose';

@Schema({
	collection: 'grade_reviews',
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
	toJSON: {
		getters: true,
		virtuals: true,
	},
})
export class GradeReview extends BaseEntity {
	@Prop({
		required: true,
		ref: Class.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => Class)
	class: Class;

	// ID of the column that is being reviewed
	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
	})
	column: mongoose.Schema.Types.ObjectId;

	@Prop({
		required: true,
		type: String,
	})
	column_name: string;

	@Prop({
		required: true,
		type: String,
		maxlength: 500,
		default: '',
	})
	review_reason: string;

	@Prop({
		required: true,
		type: Number,
		max: 10,
		min: 0,
		default: 0,
	})
	expected_grade: number;

	@Prop({
		required: true,
		type: Number,
		max: 10,
		min: 0,
		default: 0,
	})
	current_grade: number;

	@Prop({
		required: true,
		type: Number,
		max: 10,
		min: 0,
		default: 0,
	})
	updated_grade: number;

	@Prop({
		required: true,
		ref: User.name,
		type: mongoose.Schema.Types.ObjectId,
	})
	@Type(() => User)
	request_student: User;

	@Prop({
		required: true,
		type: String,
	})
	request_student_id: string;

	@Prop({
		required: false,
		default: [],
		type: [
			{
				type: ReviewCommentSchema,
			},
		],
	})
	@Type(() => ReviewComment)
	comments: ReviewComment[];

	@Prop({
		required: true,
		type: Boolean,
		default: false,
	})
	isFinished: boolean;
}

export const GradeReviewSchema = SchemaFactory.createForClass(GradeReview);

export function GradeReviewSchemaFactory() {
	return GradeReviewSchema;
}
