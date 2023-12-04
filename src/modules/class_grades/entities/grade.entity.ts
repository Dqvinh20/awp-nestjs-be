import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { GradeColumn } from './grade_column.entity';
import { Type } from 'class-transformer';

export type GradeDocument = HydratedDocument<Grade>;

@Schema()
export class Grade {
	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: GradeColumn.name,
		unique: true,
		index: true,
	})
	@Type(() => GradeColumn)
	column: GradeColumn;

	@Prop({
		required: true,
		type: Number,
		max: 10,
		min: 0,
		default: 0,
	})
	value: number;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);
