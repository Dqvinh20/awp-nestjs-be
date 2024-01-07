import { BaseEntity } from '@modules/shared/base/base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GradeColumnDocument = HydratedDocument<GradeColumn>;

@Schema({
	toJSON: {
		getters: true,
		virtuals: true,
	},
})
export class GradeColumn extends BaseEntity {
	@Prop({
		required: true,
		type: String,
		maxlength: 100,
		set: (val: string) => val.trim(),
	})
	name!: string;

	@Prop({
		required: true,
		type: Number,
		min: 0,
		default: 0,
	})
	ordinal!: number;

	@Prop({
		required: true,
		default: 0,
		type: Number,
		min: 0,
		max: 100,
	})
	scaleValue!: number;
}

export const GradeColumnSchema = SchemaFactory.createForClass(GradeColumn);
