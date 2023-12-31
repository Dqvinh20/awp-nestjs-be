import { Class } from '@modules/classes/entities/class.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { GradeColumn, GradeColumnSchema } from './grade_column.entity';
import { Transform, Type } from 'class-transformer';
import { BaseEntity } from '@modules/shared/base/base.entity';
import { GradeRow, GradeRowSchema } from './grade_row.entity';

export type ClassGradeDocument = HydratedDocument<ClassGrade>;

@Schema({
	collection: 'class_grades',
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
	toJSON: {
		getters: true,
		virtuals: true,
	},
})
export class ClassGrade extends BaseEntity {
	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: Class.name,
		unique: true,
		index: true,
	})
	@Transform(
		({ value }) => {
			return value.id.toString();
		},
		{
			toPlainOnly: true,
		},
	)
	@Type(() => Class)
	class: Class;

	@Prop({
		type: [
			{
				type: GradeColumnSchema,
			},
		],
		default: [],
	})
	@Type(() => GradeColumn)
	grade_columns: GradeColumn[];

	@Prop({
		type: [
			{
				type: GradeRowSchema,
			},
		],
		default: [],
	})
	@Type(() => GradeRow)
	grade_rows: GradeRow[];

	@Prop({
		default: false,
		type: Boolean,
	})
	isFinished: boolean;
}

export const ClassGradeSchema = SchemaFactory.createForClass(ClassGrade);

export const ClassGradeSchemaFactory = () => {
	const classGradeSchema = ClassGradeSchema;
	return classGradeSchema;
};
