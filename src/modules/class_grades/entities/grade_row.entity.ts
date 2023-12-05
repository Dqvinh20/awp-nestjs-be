import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Transform, Type } from 'class-transformer';
import { User } from '@modules/users/entities/user.entity';
import { Grade, GradeSchema } from './grade.entity';

export type GradeRowDocument = HydratedDocument<GradeRow>;

@Schema({
	strict: false,
	toJSON: {
		getters: true,
		virtuals: true,
	},
	_id: true,
	timestamps: false,
	versionKey: false,
})
export class GradeRow {
	@Prop({ required: true, unique: true, auto: true })
	_id?: mongoose.Schema.Types.ObjectId;

	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: User.name,
		unique: true,
	})
	@Transform(
		({ value }) => {
			return value?.id.toString();
		},
		{
			toPlainOnly: true,
		},
	)
	@Type(() => User)
	student: User;

	@Prop({
		required: false,
	})
	student_id?: string;

	@Prop({
		required: false,
		type: String,
		min: 0,
		max: 100,
	})
	full_name: string;

	@Prop({
		required: true,
		type: [
			{
				type: GradeSchema,
			},
		],
		default: [],
	})
	@Type(() => Grade)
	grades: Grade[];
}

export const GradeRowSchema = SchemaFactory.createForClass(GradeRow);