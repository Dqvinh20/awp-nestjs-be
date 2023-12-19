import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';
import { intersectionWith } from 'lodash';
import { Error } from 'mongoose';
import * as mongoosePaginate from 'mongoose-paginate-v2';
import { ConfigService } from '@nestjs/config';

export type ClassDocument = HydratedDocument<Class>;

@Schema({
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
	toJSON: {
		getters: true,
		virtuals: true,
	},
})
export class Class extends BaseEntity {
	@Prop({
		required: true,
		minlength: 1,
		maxlength: 100,
		set: (name: string) => {
			return name.trim();
		},
	})
	name: string;

	@Prop({
		maxlength: 300,
		default: null,
		set: (description?: string) => {
			return description ? description.trim() : null;
		},
	})
	description: string;

	@Prop({
		required: true,
		unique: true,
		index: true,
		length: 7,
	})
	code: string;

	@Prop({
		type: [
			{
				required: false,
				type: mongoose.Schema.Types.ObjectId,
				ref: User.name,
				unique: true,
			},
		],
	})
	@Type(() => User)
	teachers: User[];

	@Prop({
		type: [
			{
				required: false,
				type: mongoose.Schema.Types.ObjectId,
				ref: User.name,
				unique: true,
			},
		],
	})
	@Type(() => User)
	students: User[];

	@Prop({
		default: true,
	})
	isJoinable: boolean;

	@Prop({
		default: true,
	})
	isActive: boolean;

	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: User.name,
	})
	@Type(() => User)
	owner: User;
}

export const ClassSchema = SchemaFactory.createForClass(Class);

export const ClassSchemaFactory = async (configService: ConfigService) => {
	const class_schema = ClassSchema;

	class_schema.virtual('news', {
		ref: 'Notification',
		localField: '_id',
		foreignField: 'class',
		options: {
			sort: {
				created_at: -1,
			},
		},
	});

	class_schema
		.virtual('public_invitation_link')
		.get(function (this: ClassDocument) {
			if (this.isJoinable) {
				return `${configService.get<string>('BASE_FE_URL')}/classes/join?c=${
					this.code
				}`;
			}
		});

	class_schema.pre('save', function (next) {
		const results = intersectionWith(this.teachers, this.students, (a, b) => {
			return a.toString() === b.toString();
		});
		if (results.length === 0) next();

		const validationError = new Error.ValidationError();
		validationError.addError(
			'students or teachers',
			new Error.ValidatorError({
				message: "Teacher can't be a student and vice versa",
			}),
		);
		next(validationError);
	});

	class_schema.plugin(mongoosePaginate);

	return class_schema;
};
