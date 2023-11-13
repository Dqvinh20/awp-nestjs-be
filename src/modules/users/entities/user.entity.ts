import { BaseEntity } from '@modules/shared/base/base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Address, AddressSchema } from './address.entity';
import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { UserRole } from '@modules/user-roles/entities/user-role.entity';

export type UserDocument = HydratedDocument<User>;

export enum GENDER {
	MALE = 'Male',
	FEMALE = 'Female',
	OTHER = 'Other',
}

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
export class User extends BaseEntity {
	@Prop({
		required: false,
		minlength: 2,
		maxlength: 60,
		set: (first_name: string) => {
			return first_name.trim();
		},
	})
	first_name: string;

	@Prop({
		required: false,
		minlength: 2,
		maxlength: 60,
		set: (last_name: string) => {
			return last_name.trim();
		},
	})
	last_name: string;

	@Prop({
		required: true,
		unique: true,
		match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
	})
	// @Expose({ name: 'mail', toPlainOnly: true })
	email: string;

	@Exclude()
	@Prop({
		required: true,
	})
	password: string;

	@Prop({
		default:
			'https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_960_720.png',
	})
	avatar: string;

	@Prop({
		enum: GENDER,
	})
	gender: GENDER;

	@Prop({
		type: mongoose.Schema.Types.ObjectId,
		ref: UserRole.name,
	})
	@Type(() => UserRole)
	@Transform((value) => value.obj.role?.name, { toClassOnly: true })
	role: UserRole;

	@Prop({
		type: [
			{
				type: AddressSchema,
			},
		],
	})
	@Type(() => Address)
	address: Address[];

	default_address?: string;

	@Prop()
	@Exclude()
	current_refresh_token: string;

	@Expose({ name: 'full_name' })
	get fullName(): string {
		return `${this.first_name} ${this.last_name}`;
	}
}

export const UserSchema = SchemaFactory.createForClass(User);

export const UserSchemaFactory = () => {
	const user_schema = UserSchema;

	user_schema.virtual('default_address').get(function (this: UserDocument) {
		if (this.address.length) {
			return `${(this.address[0].street && ' ') || ''}${this.address[0].city} ${
				this.address[0].state
			} ${this.address[0].country}`;
		}
	});
	return user_schema;
};
