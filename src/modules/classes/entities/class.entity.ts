import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';

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
		type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
	})
	@Type(() => User)
	teachers: User[];

	@Prop({
		type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
	})
	@Type(() => User)
	students: User[];

	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: User.name,
	})
	@Type(() => User)
	owner: User;
}

export const ClassSchema = SchemaFactory.createForClass(Class);
