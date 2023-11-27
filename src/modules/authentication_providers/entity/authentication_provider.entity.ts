import { BaseEntity } from '@modules/shared/base/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { HydratedDocument } from 'mongoose';

export type AuthenticationProviderDocument =
	HydratedDocument<AuthenticationProvider>;

export enum PROVIDER_TYPE {
	FACEBOOK = 'facebook',
	GOOGLE = 'google',
}

@Schema({
	collection: 'authentication_providers',
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
})
export class AuthenticationProvider extends BaseEntity {
	@Prop({
		required: true,
		type: mongoose.Schema.Types.ObjectId,
		ref: User.name,
	})
	@Type(() => User)
	user: User;

	@Prop({
		required: true,
		enum: PROVIDER_TYPE,
	})
	provider_type: PROVIDER_TYPE;

	@Prop({
		required: true,
	})
	provider_user_id: string;

	@Prop({
		required: false,
	})
	access_token?: string;

	@Prop({
		required: false,
	})
	refresh_token?: string;
}

export const AuthenticationProviderSchema = SchemaFactory.createForClass(
	AuthenticationProvider,
);
